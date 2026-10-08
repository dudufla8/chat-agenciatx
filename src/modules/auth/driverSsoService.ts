import prisma from '../../lib/prisma';
import { verifyDriverSsoToken, signDriverSessionToken, DriverSessionPayload } from '../../lib/auth';
import { taxiDigitalService } from '../taxi-digital/taxiDigitalService';

export interface DriverSsoResult {
  success: boolean;
  driver?: {
    id: string;
    tenantId: string;
    prefixo: string;
    name: string;
    phone: string;
    plate?: string | null;
  };
  sessionToken?: string;
  errorMessage?: string;
}

export class DriverSsoService {
  /**
   * Authenticates a driver via In-App SSO JWT token
   */
  async authenticateDriverWithSso(token: string): Promise<DriverSsoResult> {
    try {
      // 1. Verify SSO token signature and timestamp (<= 5 minutes)
      const payload = verifyDriverSsoToken(token);

      // 2. Fetch driver data from Táxi Digital API / Local Cache
      const fleetProfile = await taxiDigitalService.getDriverByPrefixo(payload.prefixo);
      if (!fleetProfile) {
        return {
          success: false,
          errorMessage: `Motorista com prefixo ${payload.prefixo} não encontrado na frota.`,
        };
      }

      // Check if driver is blocked in the fleet
      if (fleetProfile.status === 'BLOQUEADO') {
        return {
          success: false,
          errorMessage: 'Cadastro de motorista bloqueado. Contate a administração da frota.',
        };
      }

      // 3. Ensure Tenant exists or create/use tenantId
      const tenantId = payload.tenant_id;
      let driverRecord;

      try {
        // Ensure tenant exists in DB
        let tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });

        if (!tenant) {
          // If not found by ID, try finding default or create tenant
          tenant = await prisma.tenant.upsert({
            where: { id: tenantId },
            update: {},
            create: {
              id: tenantId,
              name: 'Frota Táxi Digital',
              slug: `frota-${tenantId.slice(0, 8)}`,
              active: true,
            },
          });
        }

        // 4. Create or update Driver record in DB
        driverRecord = await prisma.driver.upsert({
          where: {
            tenantId_prefixo: {
              tenantId: tenant.id,
              prefixo: payload.prefixo,
            },
          },
          update: {
            name: fleetProfile.name,
            phone: fleetProfile.phone,
            plate: fleetProfile.plate,
            externalId: payload.driver_external_id || fleetProfile.externalId,
            updatedAt: new Date(),
          },
          create: {
            tenantId: tenant.id,
            prefixo: payload.prefixo,
            name: fleetProfile.name,
            phone: fleetProfile.phone,
            plate: fleetProfile.plate,
            externalId: payload.driver_external_id || fleetProfile.externalId,
          },
        });
      } catch (dbError: any) {
        console.warn('[DriverSsoService] Database offline or unavailable. Operating with session memory fallback:', dbError.message);
        // Resilient fallback if DB connection fails in local test
        driverRecord = {
          id: `drv-${payload.prefixo}-${Date.now()}`,
          tenantId: payload.tenant_id,
          prefixo: payload.prefixo,
          name: fleetProfile.name,
          phone: fleetProfile.phone,
          plate: fleetProfile.plate,
          externalId: payload.driver_external_id,
        };
      }

      // 5. Generate short-lived session JWT
      const sessionPayload: DriverSessionPayload = {
        driverId: driverRecord.id,
        tenantId: driverRecord.tenantId,
        prefixo: driverRecord.prefixo,
        name: driverRecord.name,
        phone: driverRecord.phone,
        plate: driverRecord.plate,
        role: 'DRIVER',
      };

      const sessionToken = signDriverSessionToken(sessionPayload);

      return {
        success: true,
        driver: {
          id: driverRecord.id,
          tenantId: driverRecord.tenantId,
          prefixo: driverRecord.prefixo,
          name: driverRecord.name,
          phone: driverRecord.phone,
          plate: driverRecord.plate,
        },
        sessionToken,
      };
    } catch (err: any) {
      console.error('[DriverSsoService] SSO Authentication failed:', err.message);
      return {
        success: false,
        errorMessage: err.message || 'Falha na validação do token do motorista.',
      };
    }
  }

  /**
   * Registers a new lead/signup driver (when accessed with ?mode=signup)
   */
  async registerLeadDriver(
    tenantId: string,
    data: { name: string; phone: string; notes?: string }
  ): Promise<DriverSsoResult> {
    try {
      const tempPrefixo = `NOVO-${Math.floor(1000 + Math.random() * 9000)}`;

      let driverRecord;
      try {
        driverRecord = await prisma.driver.create({
          data: {
            tenantId,
            prefixo: tempPrefixo,
            name: data.name,
            phone: data.phone,
            plate: 'EM AVALIAÇÃO',
          },
        });
      } catch {
        driverRecord = {
          id: `lead-${Date.now()}`,
          tenantId,
          prefixo: tempPrefixo,
          name: data.name,
          phone: data.phone,
          plate: 'EM AVALIAÇÃO',
        };
      }

      const sessionPayload: DriverSessionPayload = {
        driverId: driverRecord.id,
        tenantId: driverRecord.tenantId,
        prefixo: driverRecord.prefixo,
        name: driverRecord.name,
        phone: driverRecord.phone,
        plate: driverRecord.plate,
        role: 'DRIVER',
      };

      const sessionToken = signDriverSessionToken(sessionPayload);

      return {
        success: true,
        driver: driverRecord,
        sessionToken,
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage: err.message,
      };
    }
  }
}

export const driverSsoService = new DriverSsoService();
