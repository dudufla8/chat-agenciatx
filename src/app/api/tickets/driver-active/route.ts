import { NextRequest, NextResponse } from 'next/server';
import { verifyDriverSessionToken } from '@/lib/auth';
import { ticketService } from '@/modules/tickets/ticketService';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get('driver_session')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookie || authHeader;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const driver = verifyDriverSessionToken(token);
    if (!driver) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
    }

    const { ticket } = await ticketService.getOrCreateActiveTicketForDriver({
      id: driver.driverId,
      tenantId: driver.tenantId,
      prefixo: driver.prefixo,
      name: driver.name,
      phone: driver.phone,
      plate: driver.plate,
    });

    return NextResponse.json({ success: true, ticket, driver });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
