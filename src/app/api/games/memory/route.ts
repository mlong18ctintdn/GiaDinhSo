import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { broadcast } from '@/lib/supabase/broadcast';
import { normCode } from '@/lib/family';
import { consumeUsage, refundUsage, type UsageInfo } from '@/lib/usage';
import { loadGame, saveGame } from '@/lib/games';
import { IDLE_MEMORY, flipCard, resolveFlip, settle, skipTurn, startMemory, type MemoryState, type Player } from '@/lib/memory-game';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STALE_ROUND_MS = 10 * 60_000; // a round nobody touched for 10 minutes may be replaced

/**
 * Memory Flip Cards. actions: start | flip | resolve | skip | end. The server is the only referee.
 * Every write is a compare-and-set on `version`, so simultaneous clicks cannot corrupt a round.
 */
export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  const action = b?.action as string;
  if (!code || !['start', 'flip', 'resolve', 'skip', 'end'].includes(action) || (action !== 'resolve' && !UUID.test(String(b?.member_id)))) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const requestId = String(b?.request_id ?? '').slice(0, 64) || null;
  const sb = supabaseAdmin();
  let usage: UsageInfo | undefined;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { state: raw, version } = await loadGame<MemoryState>(code, 'memory');
    const now = Date.now();
    const state = settle(raw, now); // apply a pair-hide that is already due, BEFORE judging whose turn it is
    let next: MemoryState = state;
    let charged = false;

    if (action === 'start') {
      // Idempotent: a double click, a second tab, or a retry gets the round that is already running. Never an error.
      const running = state.status === 'playing' && now - state.lastMoveAt < STALE_ROUND_MS;
      if (running || (requestId && state.startId === requestId)) {
        return NextResponse.json({ state, version, serverNow: now, already: true });
      }
      const { data: members } = await sb.from('members').select('id,name,avatar').eq('family_code', code).order('created_at', { ascending: true });
      if (!members?.some((m) => m.id === b.member_id)) return NextResponse.json({ error: 'invalid_member' }, { status: 400 });
      const u = await consumeUsage(code); // one free use per NEW round
      if (!u.ok) return u.res;
      usage = u.usage;
      charged = true;
      next = startMemory(members as Player[], now, (n) => randomInt(n), requestId);
    } else if (action === 'end') {
      const { data: m } = await sb.from('members').select('id').eq('family_code', code).eq('id', b.member_id).maybeSingle();
      if (!m) return NextResponse.json({ error: 'invalid_member' }, { status: 400 });
      next = IDLE_MEMORY;
    } else if (action === 'flip') {
      const r = flipCard(state, b.member_id, Number(b.index), now);
      if (!r.ok) return NextResponse.json({ error: r.error, state, version, serverNow: now }, { status: 409 });
      next = r.state;
    } else if (action === 'resolve') {
      next = resolveFlip(raw, now);
      if (next === raw) return NextResponse.json({ state: raw, version, serverNow: now });
    } else {
      const r = skipTurn(state, now);
      if (!r.ok) return NextResponse.json({ error: r.error, state, version, serverNow: now }, { status: 409 });
      next = r.state;
    }

    if (await saveGame(code, 'memory', next, version)) {
      await broadcast(code, 'memory');
      return NextResponse.json({ state: next, version: version + 1, serverNow: Date.now(), ...(usage ? { usage } : {}) });
    }
    if (charged) await refundUsage(code); // lost the race: give the free use back, then retry on fresh state
  }
  return NextResponse.json({ error: 'conflict' }, { status: 409 });
});

