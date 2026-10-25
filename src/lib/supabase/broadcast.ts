export type BroadcastEvent = 'stories' | 'family' | 'members' | 'reminders' | 'memory' | 'wheel';

/**
 * Tell every open browser of a family to refresh. Never throws.
 * Uses Supabase Realtime's HTTP endpoint: one fast request, no WebSocket handshake.
 * (The old code opened a channel and waited up to 2.5 s on EVERY action: that is why the chore wheel felt frozen.)
 */
export async function broadcast(code: string, event: BroadcastEvent) {
  try {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
    if (!url || !key) return;
    const topic = event === 'memory' || event === 'wheel' ? `family:${code}:games` : `family:${code}`;
    const r = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic, event, payload: {}, private: false }] }),
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) console.warn('broadcast http', r.status);
  } catch (e) {
    console.warn('broadcast failed', e instanceof Error ? e.message : e);
  }
}
