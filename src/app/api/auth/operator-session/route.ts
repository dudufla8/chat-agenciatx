import { NextRequest, NextResponse } from 'next/server';
import { verifyOperatorToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('operator_token')?.value;
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  const token = cookie || authHeader;

  if (!token) {
    return NextResponse.json({ authenticated: false, error: 'Sessão inexistente.' }, { status: 401 });
  }

  const payload = verifyOperatorToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false, error: 'Token expirado ou inválido.' }, { status: 401 });
  }

  let userDetails: any = null;
  try {
    userDetails = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { departments: true, tenant: true },
    });
  } catch {
    // fallback
  }

  return NextResponse.json({
    authenticated: true,
    user: userDetails || {
      id: payload.userId,
      tenantId: payload.tenantId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      departments: [
        { id: 'dep-cad', name: 'Cadastro & Veículos', slug: 'cadastro-veiculos' },
        { id: 'dep-cor', name: 'Corridas & Operacional', slug: 'corridas-operacional' },
        { id: 'dep-fin', name: 'Financeiro & Pagamentos', slug: 'financeiro-pagamentos' },
      ],
    },
    token,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logout realizado.' });
  response.cookies.delete('operator_token');
  return response;
}
