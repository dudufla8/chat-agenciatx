import { NextRequest, NextResponse } from 'next/server';
import { verifyOperatorToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get('operator_token')?.value;
    const token = cookie || req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const session = verifyOperatorToken(token);
    if (!session) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

    let flow = await prisma.botFlow.findUnique({
      where: { tenantId: session.tenantId },
    });

    if (!flow) {
      // Default initial flow
      const defaultNodes = [
        {
          id: '1',
          label: 'Atualização de Cadastro / Veículo',
          departmentSlug: 'cadastro-veiculos',
          responseMsg: 'Encaminhando para nossa equipe de Cadastro e Veículos...',
        },
        {
          id: '2',
          label: 'Corridas & Ocorrências Operacionais',
          departmentSlug: 'corridas-operacional',
          responseMsg: 'Conectando com o setor de Operações e Corridas...',
        },
        {
          id: '3',
          label: 'Novo Cadastro - Quero participar',
          departmentSlug: 'comercial-novos-cadastros',
          responseMsg: 'Ótimo! Transferindo para o Credenciamento e Novos Membros...',
        },
        {
          id: '4',
          label: 'Dúvidas Gerais / Outros Assuntos',
          departmentSlug: 'duvidas-gerais',
          responseMsg: 'Um momento, transferindo para nosso atendimento geral...',
        },
        {
          id: '5',
          label: 'Financeiro & Pagamentos / PIX',
          departmentSlug: 'financeiro-pagamentos',
          responseMsg: 'Transferindo para o departamento Financeiro...',
        },
      ];

      flow = await prisma.botFlow.create({
        data: {
          tenantId: session.tenantId,
          welcomeMsg: 'Olá! Seja bem-vindo à nossa Central de Atendimento Inteligente.\n\nPor favor, escolha uma das opções abaixo para direcionarmos seu chamado:',
          fallbackMsg: 'Desculpe, não entendi essa opção. Por favor, digite o número correspondente:',
          nodes: defaultNodes,
        },
      });
    }

    return NextResponse.json({ success: true, flow });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get('operator_token')?.value;
    const token = cookie || req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const session = verifyOperatorToken(token);
    if (!session) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

    const { welcomeMsg, fallbackMsg, nodes } = await req.json();

    const flow = await prisma.botFlow.upsert({
      where: { tenantId: session.tenantId },
      update: {
        welcomeMsg: welcomeMsg || undefined,
        fallbackMsg: fallbackMsg || undefined,
        nodes: nodes || undefined,
      },
      create: {
        tenantId: session.tenantId,
        welcomeMsg: welcomeMsg || 'Olá! Seja bem-vindo à nossa Central de Atendimento Inteligente.',
        fallbackMsg: fallbackMsg || 'Por favor, selecione uma das opções válidas:',
        nodes: nodes || [],
      },
    });

    return NextResponse.json({ success: true, flow });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
