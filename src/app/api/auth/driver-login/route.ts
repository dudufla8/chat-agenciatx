import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { signDriverSessionToken, DriverSessionPayload } from '@/lib/auth';
import { taxiDigitalService } from '@/modules/taxi-digital/taxiDigitalService';

/**
 * POST /api/auth/driver-login
 * Direct driver identification via Prefixo + Placa / Telefone
 * Sets a 30-day persistent session cookie and returns driver profile
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prefixo, plate, name, phone } = body;

    if (!prefixo) {
      return NextResponse.json(
        { success: false, error: 'Por favor, informe o prefixo do motorista.' },
        { status: 400 }
      );
    }

    const cleanPrefixo = String(prefixo).trim();
    const cleanPlate = (plate || '').trim().toUpperCase();

    // 1. Query Táxi Digital API / Fleet Cache
    const fleetProfile = await taxiDigitalService.getDriverByPrefixo(cleanPrefixo, {
      plate: cleanPlate || undefined,
      name: name?.trim() || undefined,
      phone: phone?.trim() || undefined,
    });

    if (!fleetProfile) {
      return NextResponse.json(
        { success: false, error: `Prefixo #${cleanPrefixo} não encontrado na base da central.` },
        { status: 404 }
      );
    }

    // 2. Resolve default Tenant
    let tenant = await prisma.tenant.findFirst({
      where: { active: true },
    });

    if (!tenant) {
      tenant = await prisma.tenant.upsert({
        where: { slug: 'central-taxi-frotas' },
        update: {},
        create: {
          id: 'tenant-taxi-principal',
          name: 'Central Táxi Frotas',
          slug: 'central-taxi-frotas',
          active: true,
        },
      });
    }

    // 3. Upsert driver in DB
    const driverRecord = await prisma.driver.upsert({
      where: {
        tenantId_prefixo: {
          tenantId: tenant.id,
          prefixo: cleanPrefixo,
        },
      },
      update: {
        name: name?.trim() || fleetProfile.name,
        phone: phone?.trim() || fleetProfile.phone,
        plate: cleanPlate || fleetProfile.plate,
        updatedAt: new Date(),
      },
      create: {
        tenantId: tenant.id,
        prefixo: cleanPrefixo,
        name: name?.trim() || fleetProfile.name,
        phone: phone?.trim() || fleetProfile.phone,
        plate: cleanPlate || fleetProfile.plate,
        externalId: fleetProfile.externalId || `TX-${cleanPrefixo}`,
      },
    });

    // 4. Create 30-day persistent session token
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

    const response = NextResponse.json({
      success: true,
      driver: {
        id: driverRecord.id,
        prefixo: driverRecord.prefixo,
        name: driverRecord.name,
        phone: driverRecord.phone,
        plate: driverRecord.plate,
        status: fleetProfile.status,
      },
      token: sessionToken,
    });

    // Persistent cookie (30 days)
    response.cookies.set('driver_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err: any) {
    console.error('[Driver Login API] Error:', err.message);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao autenticar motorista.' },
      { status: 500 }
    );
  }
}
