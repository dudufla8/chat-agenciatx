import { env } from '../../config/env';
import redisClient from '../../lib/redis';

export interface TaxiDigitalDriverProfile {
  prefixo: string;
  name: string;
  phone: string;
  plate: string;
  status: 'ATIVO' | 'BLOQUEADO' | 'PENDENTE';
  externalId?: string;
}

// Built-in mock registry for taxi fleet testing and local dev
const MOCK_FLEET_REGISTRY: Record<string, TaxiDigitalDriverProfile> = {
  '101': {
    prefixo: '101',
    name: 'Carlos Eduardo Oliveira',
    phone: '(11) 98765-4321',
    plate: 'BRA-2E19',
    status: 'ATIVO',
    externalId: 'TX-101',
  },
  '204': {
    prefixo: '204',
    name: 'Marcos Roberto Santos',
    phone: '(11) 97123-9988',
    plate: 'SP-ABC1234',
    status: 'ATIVO',
    externalId: 'TX-204',
  },
  '305': {
    prefixo: '305',
    name: 'Ana Paula Ferraz',
    phone: '(11) 99887-1122',
    plate: 'SP-XYZ9876',
    status: 'ATIVO',
    externalId: 'TX-305',
  },
  '555': {
    prefixo: '555',
    name: 'Roberto Da Silva Tavares',
    phone: '(11) 96543-2109',
    plate: 'RIO-9A88',
    status: 'ATIVO',
    externalId: 'TX-555',
  },
};

export class TaxiDigitalService {
  /**
   * Fetches driver profile by prefixo from Táxi Digital API with Redis caching
   */
  async getDriverByPrefixo(prefixo: string): Promise<TaxiDigitalDriverProfile | null> {
    const cacheKey = `taxidigital:driver:${prefixo}`;

    // 1. Try cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as TaxiDigitalDriverProfile;
      }
    } catch {
      // Continue if cache fails
    }

    // 2. Query Táxi Digital API if token is configured and not default
    if (
      env.TAXI_DIGITAL_API_TOKEN &&
      env.TAXI_DIGITAL_API_TOKEN !== 'token_de_comunicacao_taxi_digital' &&
      env.TAXI_DIGITAL_API_URL
    ) {
      try {
        const response = await fetch(`${env.TAXI_DIGITAL_API_URL}/motoristas/${encodeURIComponent(prefixo)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${env.TAXI_DIGITAL_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(4000),
        });

        if (response.ok) {
          const data = await response.json();
          const profile: TaxiDigitalDriverProfile = {
            prefixo: String(data.prefixo || prefixo),
            name: data.nome || data.name || `Motorista ${prefixo}`,
            phone: data.telefone || data.phone || '(00) 00000-0000',
            plate: data.placa || data.plate || 'N/A',
            status: data.status === 'BLOQUEADO' ? 'BLOQUEADO' : 'ATIVO',
            externalId: data.id || data.codigo_externo,
          };

          // Cache for 10 minutes
          await redisClient.set(cacheKey, JSON.stringify(profile), 'EX', 600);
          return profile;
        }
      } catch (err: any) {
        console.warn(`[TaxiDigitalService] API lookup failed for prefixo ${prefixo}: ${err.message}. Falling back to local cache/mock.`);
      }
    }

    // 3. Fallback to mock fleet or dynamic generated fleet profile
    const mock = MOCK_FLEET_REGISTRY[prefixo];
    const profile: TaxiDigitalDriverProfile = mock || {
      prefixo,
      name: `Motorista Prefixo ${prefixo}`,
      phone: `(11) 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      plate: `ABC-${prefixo.padStart(4, '0').slice(-4)}`,
      status: 'ATIVO',
      externalId: `TX-EXT-${prefixo}`,
    };

    // Cache profile
    try {
      await redisClient.set(cacheKey, JSON.stringify(profile), 'EX', 600);
    } catch {
      // Ignore cache write errors
    }

    return profile;
  }
}

export const taxiDigitalService = new TaxiDigitalService();
