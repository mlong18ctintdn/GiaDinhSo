import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normCode } from '@/lib/family';
import { getPaymentStatus } from '@/lib/payos';
import { activatePayment } from '@/lib/payos/activate';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

/**
 * The paywall polls this. ?verify=1 also asks PayOS directly, so PRO switches on even if the webhook is late
 * or not registered yet.
 */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const code = normCode(p.get('code'));
  const orderCode = Number(p.get('orderCode'));
  if (!code || !Number.isSafeInteger(orderCode)) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { data: pay } = await supabaseAdmin().from('payments').select('status,amount').eq('order_code', orderCode).eq('family_code', code).maybeSingle();
  if (!pay) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (pay.status === 'paid') return NextResponse.json({ status: 'paid' });

  if (p.get('verify')) {
    const live = await getPaymentStatus(orderCode);
    if (live?.status === 'PAID') {
      const r = await activatePayment(orderCode, live.amountPaid || pay.amount);
      if (r.ok) return NextResponse.json({ status: 'paid' });
    }
    if (live && ['CANCELLED', 'EXPIRED'].includes(live.status)) return NextResponse.json({ status: live.status.toLowerCase() });
  }
  return NextResponse.json({ status: 'pending' });
});
