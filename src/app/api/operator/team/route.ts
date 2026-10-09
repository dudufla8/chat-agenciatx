import { NextRequest, NextResponse } from 'next/server';
import { verifyOperatorToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get('operator_token')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookie || authHeader;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const session = verifyOperatorToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    }

    const team = await prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        departments: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, team });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get('operator_token')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookie || authHeader;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const session = verifyOperatorToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, password, role, departmentIds } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, e-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Este e-mail já está cadastrado no sistema.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: role === 'ADMIN' ? 'ORG_ADMIN' : 'OPERATOR',
        departments: departmentIds && departmentIds.length > 0 ? {
          connect: departmentIds.map((id: string) => ({ id })),
        } : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        departments: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookie = req.cookies.get('operator_token')?.value;
    const token = cookie || req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const session = verifyOperatorToken(token);
    if (!session) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) return NextResponse.json({ error: 'ID do usuário não fornecido.' }, { status: 400 });

    if (userId === session.userId) {
      return NextResponse.json({ error: 'Você não pode excluir sua própria conta.' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: userId, tenantId: session.tenantId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
