import { NextRequest, NextResponse } from 'next/server';
import { generateTestDriverSsoToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { prefixo = '101', tenantId = 'tenant-taxi-principal', externalId = 'tx-ext-01' } = await req.json();

    const token = generateTestDriverSsoToken(tenantId, prefixo, externalId);
    const authUrl = `/driver/auth?token=${token}`;

    return NextResponse.json({
      success: true,
      token,
      authUrl,
      payload: {
        tenant_id: tenantId,
        prefixo,
        driver_external_id: externalId,
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
