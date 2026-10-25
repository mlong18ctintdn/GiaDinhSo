import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { broadcast } from '@/lib/supabase/broadcast';
import { normCode } from '@/lib/family';
import { consumeUsage, refundUsage, withUsage } from '@/lib/usage';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REMINDER_ID = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{1,18})$/i; // uuid, or a number in older tables
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = route(async (req: Request) => {
  const code = normCode(new URL(req.url).searchParams.get('code'));
  if (!code) return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  const { data, error } = await supabaseAdmin()
    .from('reminders')
    .select('*')
    .eq('family_code', code)
    .order('remind_time', { ascending: true });
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  return NextResponse.json({ reminders: data ?? [] });
});

/** Anyone in the family can set a reminder for any member, or for everyone (member_id = null). */
export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  const text = String(b?.text ?? '').trim().slice(0, 100);
  const repeat = b?.repeat;
  if (!code || !text || !TIME.test(String(b?.remind_time)) || !['daily', 'weekdays', 'once'].includes(repeat)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (repeat === 'once' && !DATE.test(String(b?.once_date))) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const sb = supabaseAdmin();
  for (const id of [b?.member_id, b?.created_by]) {
    if (id == null) continue;
    if (!UUID.test(String(id))) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    const { data: m } = await sb.from('members').select('id').eq('id', id).eq('family_code', code).maybeSingle();
    if (!m) return NextResponse.json({ error: 'invalid_member' }, { status: 400 });
  }
  const { count } = await sb.from('reminders').select('id', { count: 'exact', head: true }).eq('family_code', code);
  if ((count ?? 0) >= 50) return NextResponse.json({ error: 'too_many_reminders' }, { status: 400 });

  const usage = await consumeUsage(code); // adding a reminder costs one free use
  if (!usage.ok) return usage.res;
  const { data, error } = await sb
    .from('reminders')
    .insert({
      family_code: code,
      member_id: b?.member_id ?? null,
      text,
      remind_time: b.remind_time,
      repeat,
      once_date: repeat === 'once' ? b.once_date : null,
      created_by: b?.created_by ?? null,
    })
    .select()
    .single();
  if (error) {
    await refundUsage(code);
    return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  }
  await broadcast(code, 'reminders');
  return withUsage({ reminder: data }, usage.usage);
});

export const DELETE = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const code = normCode(p.get('code'));
  const id = p.get('id') ?? '';
  if (!code || !REMINDER_ID.test(id)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { error } = await supabaseAdmin().from('reminders').delete().eq('id', id).eq('family_code', code);
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  await broadcast(code, 'reminders');
  return NextResponse.json({ ok: true });
});
