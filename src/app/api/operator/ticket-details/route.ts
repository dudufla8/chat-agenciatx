import { NextRequest, NextResponse } from 'next/server';
import { verifyOperatorToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get('operator_token')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookie || authHeader;

    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const operator = verifyOperatorToken(token);
    if (!operator) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get('ticketId');
    if (!ticketId) return NextResponse.json({ error: 'ticketId é obrigatório' }, { status: 400 });

    let ticket: any;
    try {
      ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          driver: true,
          department: true,
          operator: true,
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });
    } catch {
      // Handled via ticketService memory fallback if DB is offline
    }

    if (!ticket) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ticket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
