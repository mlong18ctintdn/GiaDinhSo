import { NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/payos';
import { activatePayment } from '@/lib/payos/activate';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PayOS calls this when a transfer arrives. Register in the PayOS dashboard:  https://YOUR-DOMAIN/api/payos/webhook
 * Valid signature -> always answer 200 so PayOS stops retrying (including its own "test" call with a made-up order).
 */
export const POST = route(async (req: Request) => {
  const body = await req.json().catch(() => null);
  if (!body?.data || !body?.signature || !verifyWebhook(body)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  const paid = body.success === true && body.data.code === '00';
  if (!paid) return NextResponse.json({ ok: true });

  const r = await activatePayment(Number(body.data.orderCode), Number(body.data.amount));
  if (!r.ok && r.reason !== 'not_found') console.error('payos webhook not applied:', r.reason, body.data.orderCode);
  return NextResponse.json({ ok: true });
});

/** Lets you open the URL in a browser (and PayOS's URL check) without an error. */
export const GET = () => NextResponse.json({ ok: true, service: 'payos-webhook' });
