import { NextRequest, NextResponse } from 'next/server';
import { driverSsoService } from '@/modules/auth/driverSsoService';

/**
 * POST /api/auth/driver-sso
 * Validates SSO token, sets session cookie and returns driver info
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito. Token não informado.' },
        { status: 400 }
      );
    }

    const result = await driverSsoService.authenticateDriverWithSso(token);

    if (!result.success || !result.sessionToken) {
      return NextResponse.json(
        { success: false, error: result.errorMessage || 'Acesso restrito. Abra o chat pelo aplicativo do motorista.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      driver: result.driver,
    });

    // Set HTTPOnly cookie for secure in-app browsing
    response.cookies.set('driver_session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 4, // 4 hours
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao autenticar motorista.' },
      { status: 500 }
    );
  }
}
