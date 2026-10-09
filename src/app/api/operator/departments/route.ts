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

    const departments = await prisma.department.findMany({
      where: { tenantId: session.tenantId },
      include: {
        _count: {
          select: {
            tickets: true,
            users: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, departments });
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

    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nome do departamento é obrigatório.' }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const department = await prisma.department.create({
      data: {
        tenantId: session.tenantId,
        name: name.trim(),
        slug: `${slug}-${Date.now().toString(36)}`,
      },
    });

    return NextResponse.json({ success: true, department });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
