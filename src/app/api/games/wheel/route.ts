import { NextResponse } from 'next/server';
import { randomInt, randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { broadcast } from '@/lib/supabase/broadcast';
import { normCode } from '@/lib/family';
import { consumeUsage, refundUsage } from '@/lib/usage';
import { loadGame, saveGame } from '@/lib/games';
import { isSpinning, makeSpin, type WheelMember, type WheelState } from '@/lib/wheel';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One spin costs one free use. The server picks the winner, so everyone sees the same result. */
export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  if (!code || !UUID.test(String(b?.member_id))) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const chore = String(b?.chore ?? '').trim().slice(0, 60);

  // Both reads at once: members (one cheap query, no per-member checks) and the shared wheel state.
  const [{ data: members }, first] = await Promise.all([
    supabaseAdmin().from('members').select('id,name,avatar').eq('family_code', code).order('created_at', { ascending: true }),
    loadGame<WheelState>(code, 'wheel'),
  ]);
  const by = members?.find((m) => m.id === b.member_id);
  if (!members || !by) return NextResponse.json({ error: 'invalid_member' }, { status: 400 });
  if (members.length < 2) return NextResponse.json({ error: 'need_members' }, { status: 400 });

  let { state, version } = first;
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = Date.now();
    if (isSpinning(state, now)) return NextResponse.json({ error: 'spinning', state, version, serverNow: now }, { status: 409 });
    const u = await consumeUsage(code);
    if (!u.ok) return u.res;
    const next = makeSpin(state, members as WheelMember[], by.name, chore, now, (n) => randomInt(n), randomUUID());
    if (await saveGame(code, 'wheel', next, version)) {
      await broadcast(code, 'wheel');
      return NextResponse.json({ state: next, version: version + 1, serverNow: Date.now(), usage: u.usage });
    }
    await refundUsage(code);
    ({ state, version } = await loadGame<WheelState>(code, 'wheel'));
  }
  return NextResponse.json({ error: 'conflict' }, { status: 409 });
});
