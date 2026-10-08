import { NextRequest, NextResponse } from 'next/server';
import { operatorAuthService } from '@/modules/auth/operatorAuthService';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email e senha são obrigatórios.' }, { status: 400 });
    }

    const result = await operatorAuthService.login(email, password);

    if (!result.success || !result.token) {
      return NextResponse.json({ success: false, error: result.error || 'Credenciais inválidas.' }, { status: 401 });
    }

    const res = NextResponse.json({
      success: true,
      token: result.token,
      user: result.user,
    });

    res.cookies.set('operator_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12, // 12 hours
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
