import { NextRequest, NextResponse } from 'next/server';
import { metaCloudApiProvider } from '@/modules/notifications/MetaCloudApiProvider';

/**
 * GET /api/webhooks/whatsapp
 * Meta WhatsApp Cloud API Webhook Verification Challenge
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = metaCloudApiProvider.getVerifyToken();

  if (mode === 'subscribe' && token === verifyToken) {
    console.info('[WhatsApp Webhook] Challenge verified successfully by Meta.');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[WhatsApp Webhook] Verification token mismatch or invalid mode.');
  return NextResponse.json({ error: 'Forbidden. Invalid verification token.' }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * Incoming message and delivery status payload from Meta
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.info('[WhatsApp Webhook] Payload received:', JSON.stringify(payload, null, 2));

    // Process incoming message entries
    if (payload.object === 'whatsapp_business_account' && payload.entry) {
      for (const entry of payload.entry) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value?.messages) {
            for (const msg of value.messages) {
              console.info(`[WhatsApp Webhook] Received message from: ${msg.from}, type: ${msg.type}`);
              // In future expansion: route into ticketService as omnichannel message
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
  } catch (err: any) {
    console.error('[WhatsApp Webhook] Error processing event:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
