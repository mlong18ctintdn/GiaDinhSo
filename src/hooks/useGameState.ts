'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { supabaseBrowser } from '@/lib/supabase/client';

export interface GameReply<T> { state: T; version?: number; serverNow: number }

/**
 * Live state of a shared family game. The server broadcasts after every move, so all devices update together.
 * Every state carries the server's `version`; an older answer (a slow poll that lands after a newer move)
 * is dropped, which is what used to flip the board back and cause "not your turn".
 * `now()` is the server's clock, so animations start at the same moment everywhere.
 */
export function useGameState<T>(game: 'memory' | 'wheel', initial: T) {
  const code = useApp((s) => s.code);
  const [state, setState] = useState<T>(initial);
  const skew = useRef(0); // server time minus this device's time
  const version = useRef(-1);

  const apply = useCallback((r: GameReply<T>) => {
    if (typeof r.version === 'number') {
      if (r.version < version.current) return; // stale
      version.current = r.version;
    }
    skew.current = r.serverNow - Date.now();
    setState(r.state);
  }, []);

  /** Show a move at once (before the server answers). The server's reply replaces it. */
  const optimistic = useCallback((next: T) => setState(next), []);

  const reload = useCallback(async () => {
    if (!code) return;
    try {
      apply(await api<GameReply<T>>(`/api/games?code=${code}&game=${game}`));
    } catch {
      /* keep the last known state; the next broadcast or poll retries */
    }
  }, [code, game, apply]);

  useEffect(() => {
    reload();
    const sb = supabaseBrowser();
    const ch = sb.channel(`family:${code}:games`).on('broadcast', { event: game }, () => reload()).subscribe();
    const poll = setInterval(reload, 6000); // safety net if a broadcast is missed
    return () => {
      clearInterval(poll);
      sb.removeChannel(ch);
    };
  }, [code, game, reload]);

  const now = useCallback(() => Date.now() + skew.current, []);
  return { state, apply, optimistic, now, reload };
}
