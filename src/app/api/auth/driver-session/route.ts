import { NextRequest, NextResponse } from 'next/server';
import { verifyDriverSessionToken } from '@/lib/auth';

/**
 * GET /api/auth/driver-session
 * Checks active driver session
 */
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('driver_session')?.value;
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  const token = cookie || authHeader;

  if (!token) {
    return NextResponse.json({ authenticated: false, error: 'Sessão inexistente.' }, { status: 401 });
  }

  const payload = verifyDriverSessionToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false, error: 'Sessão expirada.' }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    driver: payload,
    token,
  });
}

/**
 * DELETE /api/auth/driver-session
 * Clears driver session cookie
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  response.cookies.delete('driver_session');
  return response;
}
