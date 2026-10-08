import { NextRequest, NextResponse } from 'next/server';
import { verifyOperatorToken } from '@/lib/auth';
import { ticketService } from '@/modules/tickets/ticketService';
import { getIO } from '@/lib/socket';

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get('operator_token')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookie || authHeader;

    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const operator = verifyOperatorToken(token);
    if (!operator) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const { ticketId, notes } = await req.json();
    if (!ticketId) return NextResponse.json({ error: 'ticketId é obrigatório' }, { status: 400 });

    const updated = await ticketService.saveInternalNotes(ticketId, notes || '');

    const io = getIO();
    if (io) {
      io.to(`operator:${operator.userId}`).emit('notes_saved', { ticketId, notes });
    }

    return NextResponse.json({ success: true, ticket: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
