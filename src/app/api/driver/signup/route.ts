import { NextRequest, NextResponse } from 'next/server';
import { driverSsoService } from '@/modules/auth/driverSsoService';
import { ticketService } from '@/modules/tickets/ticketService';

export async function POST(req: NextRequest) {
  try {
    const { name, phone, city, notes } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Nome e telefone são obrigatórios.' }, { status: 400 });
    }

    const tenantId = 'tenant-taxi-principal';
    const result = await driverSsoService.registerLeadDriver(tenantId, {
      name,
      phone,
      notes: `${city ? `Cidade: ${city}. ` : ''}${notes || ''}`,
    });

    if (!result.success || !result.driver || !result.sessionToken) {
      return NextResponse.json({ success: false, error: result.errorMessage }, { status: 500 });
    }

    // Initialize ticket in queue
    const { ticket } = await ticketService.getOrCreateActiveTicketForDriver(result.driver);

    // Save lead details
    await ticketService.handleDriverMessage(
      ticket.id,
      result.driver.id,
      `[Novo Cadastro] Nome: ${name} | Tel: ${phone} | Cidade: ${city || 'N/A'} | Obs: ${notes || 'N/A'}`
    );

    const res = NextResponse.json({ success: true, driver: result.driver });

    res.cookies.set('driver_session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 4,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
