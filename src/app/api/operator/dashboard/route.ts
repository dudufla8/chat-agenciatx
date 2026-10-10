import { NextRequest, NextResponse } from 'next/server';
import { verifyOperatorToken } from '@/lib/auth';
import { ticketService } from '@/modules/tickets/ticketService';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get('operator_token')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookie || authHeader;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const operator = verifyOperatorToken(token);
    if (!operator) {
      return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 401 });
    }

    // Get filter department from search params
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId') || undefined;

    // Fetch categorized tickets
    const tickets = await ticketService.getDashboardTickets(
      operator.tenantId,
      operator.userId,
      departmentId
    );

    // Fetch canned responses
    const cannedResponses = await ticketService.getCannedResponses(operator.tenantId);

    // Fetch available departments for transfer
    let departments: any[] = [];
    try {
      departments = await prisma.department.findMany({
        where: { tenantId: operator.tenantId },
        orderBy: { name: 'asc' },
      });
    } catch {
      departments = [
        { id: 'dep-1', name: 'Cadastro & Veículos', slug: 'cadastro-veiculos' },
        { id: 'dep-2', name: 'Corridas & Operacional', slug: 'corridas-operacional' },
        { id: 'dep-3', name: 'Comercial & Novos Cadastros', slug: 'comercial-novos-cadastros' },
        { id: 'dep-4', name: 'Dúvidas Gerais', slug: 'duvidas-gerais' },
        { id: 'dep-5', name: 'Financeiro & Pagamentos', slug: 'financeiro-pagamentos' },
      ];
    }

    return NextResponse.json({
      success: true,
      operator,
      token,
      tickets,
      cannedResponses,
      departments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
