import { env } from '../../config/env';
import redisClient from '../../lib/redis';

export interface TaxiDigitalDriverProfile {
  prefixo: string;
  name: string;
  phone: string;
  plate: string;
  status: 'ATIVO' | 'BLOQUEADO' | 'PENDENTE' | 'LIVRE' | 'OCUPADO' | 'PASSAGEIRO' | 'OFFLINE';
  externalId?: string;
  latitude?: string | null;
  longitude?: string | null;
  positionDate?: string | null;
}

// Built-in mock registry for taxi fleet testing and local dev fallback
const MOCK_FLEET_REGISTRY: Record<string, Partial<TaxiDigitalDriverProfile>> = {
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
  private getAuthHeader(): string {
    const user = env.TAXI_DIGITAL_USER;
    const pass = env.TAXI_DIGITAL_PASS;
    if (!user || !pass) return '';
    return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }

  private getBaseUrl(): string {
    const url = env.TAXI_DIGITAL_BASE_URL || 'https://api.taxidigital.net/APITD/';
    return url.endsWith('/') ? url : `${url}/`;
  }

  /**
   * Fetches real-time driver profile & status from Táxi Digital API
   * Endpoint: POST /api/driver/info/json
   */
  async getDriverByPrefixo(
    prefixo: string,
    extraData?: {
      name?: string;
      phone?: string;
      plate?: string;
      externalId?: string;
    }
  ): Promise<TaxiDigitalDriverProfile | null> {
    const cacheKey = `taxidigital:driver:${prefixo}`;

    // 1. Try Redis cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as TaxiDigitalDriverProfile;
        // Merge with incoming app data if provided
        if (extraData?.name) parsed.name = extraData.name;
        if (extraData?.phone) parsed.phone = extraData.phone;
        if (extraData?.plate) parsed.plate = extraData.plate;
        return parsed;
      }
    } catch {
      // Continue if cache fails
    }

    const authHeader = this.getAuthHeader();
    const baseUrl = this.getBaseUrl();

    let tdPositionData: {
      status?: string;
      latitude?: string;
      longitude?: string;
      position_date?: string;
    } | null = null;

    // 2. Query Táxi Digital Official API
    if (authHeader) {
      try {
        const cleanPrefix = parseInt(prefixo.replace(/\D/g, ''), 10) || prefixo;
        const response = await fetch(`${baseUrl}api/driver/info/json`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'X-Versao': '3',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ driver_prefix: cleanPrefix }),
          signal: AbortSignal.timeout(4000),
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.status === 1 && resJson.data) {
            tdPositionData = resJson.data;
          }
        }
      } catch (err: any) {
        console.warn(`[TaxiDigitalService] Driver info query failed for prefixo ${prefixo}: ${err.message}`);
      }
    }

    // 3. Resolve status label (11: Livre, 12: Ocupado, 13: Passageiro)
    let driverStatus: TaxiDigitalDriverProfile['status'] = 'ATIVO';
    if (tdPositionData?.status === '11') {
      driverStatus = 'LIVRE';
    } else if (tdPositionData?.status === '12') {
      driverStatus = 'OCUPADO';
    } else if (tdPositionData?.status === '13') {
      driverStatus = 'PASSAGEIRO';
    }

    // 4. Resolve Driver Profile data (Priority: In-App SSO data > Mock/Saved > Defaults)
    const mock = MOCK_FLEET_REGISTRY[prefixo] || {};
    const finalName = extraData?.name || mock.name || `Motorista Prefixo ${prefixo}`;
    const finalPhone = extraData?.phone || mock.phone || '(00) 00000-0000';
    const finalPlate = extraData?.plate || mock.plate || `ABC-${prefixo.padStart(4, '0').slice(-4)}`;
    const finalExternalId = extraData?.externalId || mock.externalId || `TX-${prefixo}`;

    const profile: TaxiDigitalDriverProfile = {
      prefixo,
      name: finalName,
      phone: finalPhone,
      plate: finalPlate,
      status: driverStatus,
      externalId: finalExternalId,
      latitude: tdPositionData?.latitude || null,
      longitude: tdPositionData?.longitude || null,
      positionDate: tdPositionData?.position_date || null,
    };

    // 5. Cache profile in Redis (5 minutes)
    try {
      await redisClient.set(cacheKey, JSON.stringify(profile), 'EX', 300);
    } catch {
      // Ignore cache write error
    }

    return profile;
  }

  /**
   * Send text message directly to an active booking in Táxi Digital
   * Endpoint: POST /api/booking/send_message/json
   */
  async sendMessageToBooking(bookingId: number | string, message: string): Promise<boolean> {
    const authHeader = this.getAuthHeader();
    if (!authHeader) return false;

    try {
      const response = await fetch(`${this.getBaseUrl()}api/booking/send_message/json`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'X-Versao': '3',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ booking_id: bookingId, message }),
        signal: AbortSignal.timeout(5000),
      });

      const data = await response.json();
      return response.ok && data.status === 1;
    } catch (err: any) {
      console.error(`[TaxiDigitalService] Error sending booking message: ${err.message}`);
      return false;
    }
  }
}

export const taxiDigitalService = new TaxiDigitalService();
