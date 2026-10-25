import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normCode } from '@/lib/family';
import { createPaymentLink } from '@/lib/payos';
import { PLANS } from '@/lib/plans';
import { getServerAppUrl } from '@/lib/url';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  const plan = b?.plan as 'monthly' | 'yearly';
  if (!code || !Object.prototype.hasOwnProperty.call(PLANS, plan)) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: fam } = await sb.from('families').select('id').eq('family_code', code).maybeSingle();
  if (!fam) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const amount = PLANS[plan].amount;
  const memo = `FAMILY_${code}_${plan.toUpperCase()}`;
  const orderCode = Number(`${String(Date.now()).slice(-9)}${randomInt(100, 999)}`);
  const origin = getServerAppUrl(req); // NEXT_PUBLIC_APP_URL, else the Vercel URL, else this request

  const { error: insErr } = await sb.from('payments').insert({ order_code: orderCode, family_code: code, plan, amount });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  try {
    const link = await createPaymentLink({
      orderCode,
      amount,
      description: memo,
      returnUrl: `${origin}/?paid=1`,
      cancelUrl: `${origin}/`,
      expiredAt: Math.floor(Date.now() / 1000) + 15 * 60,
    });
    return NextResponse.json({
      orderCode,
      plan,
      amount,
      memo,
      qrCode: link.qrCode,
      checkoutUrl: link.checkoutUrl,
      accountNumber: link.accountNumber ?? null,
      accountName: link.accountName ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'payos_error' }, { status: 502 });
  }
});
