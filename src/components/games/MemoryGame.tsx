'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiError, post } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useGameState, type GameReply } from '@/hooks/useGameState';
import { IDLE_MEMORY, IDLE_SKIP, flipCard, settle, type MemoryState } from '@/lib/memory-game';
import { useApp } from '@/lib/store';
import { Button, cn } from '../ui';
import StartCard from './StartCard';

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** Memory Flip Cards for the whole family: take turns, everybody sees every flip live. */
export default function MemoryGame() {
  const { t } = useTranslation();
  const { code, memberId } = useApp();
  const { state: server, apply, optimistic, now, reload } = useGameState<MemoryState>('memory', IDLE_MEMORY);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [clock, tick] = useState(0);
  const lock = useRef(false); // a fast double click must never send two requests

  // Timers advance the picture without waiting for the server: a due "hide the pair" is applied on screen at once.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const state = useMemo(() => settle(server, now()), [server, clock, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = state.players[state.turn];
  const myTurn = state.status === 'playing' && current?.id === memberId;
  const inGame = state.players.some((p) => p.id === memberId);

  /** Returns the error text (empty when it worked) so the start card can show it too. */
  async function act(body: Record<string, unknown>): Promise<string> {
    if (lock.current) return '';
    lock.current = true;
    setBusy(true);
    setMsg('');
    let text = '';
    try {
      apply(await post<GameReply<MemoryState>>('/api/games/memory', { code, member_id: memberId, ...body }));
    } catch (e) {
      const key = e instanceof ApiError ? e.message : '';
      // The server sends the real state with a refusal: show it, so the screen is right again at once.
      if (e instanceof ApiError && e.body?.state) apply(e.body);
      else if (key) void reload();
      text = key === 'not_your_turn' ? t('games.notYourTurn') : key === 'busy' || key === 'wait' || key === 'conflict' ? '' : explainError(e, t);
      setMsg(text);
    }
    lock.current = false;
    setBusy(false);
    return text;
  }

  function flip(i: number) {
    if (!memberId) return;
    // Instant feedback: turn the card over locally with the same rules the server uses.
    const r = flipCard(state, memberId, i, now());
    if (r.ok) optimistic(r.state);
    void act({ action: 'flip', index: i });
  }

  // After a mismatch, whoever's screen gets there first hides the pair (safe to call twice).
  useEffect(() => {
    if (server.status !== 'playing' || server.flipped.length !== 2 || !server.resolveAt) return;
    const wait = Math.max(0, server.resolveAt - now()) + Math.random() * 400;
    const id = setTimeout(() => post<GameReply<MemoryState>>('/api/games/memory', { code, action: 'resolve' }).then(apply).catch(() => {}), wait);
    return () => clearTimeout(id);
  }, [server.resolveAt, server.flipped.length, server.status, code, apply, now]);

  if (state.status === 'idle') {
    return <StartCard title={t('games.memory')} onStart={() => act({ action: 'start', request_id: newId() })} />;
  }

  const best = state.status === 'done' ? Math.max(...Object.values(state.scores)) : 0;
  const winners = state.players.filter((p) => state.winners.includes(p.id));
  const canSkip = state.status === 'playing' && !myTurn && now() - state.lastMoveAt > IDLE_SKIP;

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
        <p className="font-semibold">
          {state.status === 'done'
            ? winners.length === 1 ? t('games.memoryWinner', { name: `${winners[0].avatar ?? ''} ${winners[0].name}`, n: best }) : t('games.memoryDraw')
            : t('games.turnOf', { name: `${current?.avatar ?? ''} ${current?.name ?? ''}` })}
        </p>
        <span className="text-sm text-muted">{t('games.moves', { n: state.moves })}</span>
      </div>

      <ul className="flex flex-wrap gap-2 text-sm">
        {state.players.map((p) => (
          <li key={p.id} className={cn('rounded-full border-2 px-3 py-1 font-semibold', state.status === 'playing' && p.id === current?.id ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
            {p.avatar} {p.name}: {t('games.pairs', { n: state.scores[p.id] ?? 0 })}
          </li>
        ))}
      </ul>

      <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2">
        {state.cards.map((c, i) => {
          const up = c.matched || state.flipped.includes(i);
          const can = myTurn && !busy && !up && state.flipped.length < 2;
          return (
            <button
              key={i}
              disabled={!can}
              onClick={() => flip(i)}
              aria-label={up ? c.emoji : `${i + 1}`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-theme border-2 text-3xl transition-transform',
                up ? 'border-border bg-bg' : 'border-accent bg-accent text-accent-fg',
                c.matched && 'border-leaf opacity-70',
                can && 'hover:scale-105',
              )}
            >
              {up ? c.emoji : '❓'}
            </button>
          );
        })}
      </div>

      {!inGame && state.status === 'playing' && <p className="text-sm text-muted">{t('games.notInRound')}</p>}
      {msg && <p role="alert" className="font-semibold text-red-600">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        {state.status === 'playing' && <Button variant="outline" onClick={() => act({ action: 'end' })} disabled={busy}>{t('games.endRound')}</Button>}
        {canSkip && <Button variant="outline" onClick={() => act({ action: 'skip' })}>{t('games.skip')}</Button>}
        {state.status === 'done' && (
          <Button onClick={() => act({ action: 'start', request_id: newId() })} disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={18} />} {t('games.newGame')}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">{t('games.live')}</p>
    </div>
  );
}
