'use client';
import { useMemo, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, cn } from '../ui';
import { useStartRound } from '@/hooks/useStartRound';
import HintButton from './HintButton';
import StartCard from './StartCard';

/**
 * Ô ăn quan. Pits 0 and 6 are the two "quan" pits (worth 10 each). Pits 1-5 belong to
 * player 0 and pits 7-11 to player 1. Two players share the screen.
 */
interface S {
  stones: number[];
  quan: boolean[];
  scores: [number, number];
  turn: 0 | 1;
  over: boolean;
}
const mod = (n: number) => (n + 12) % 12;
const isQuanPit = (p: number) => p === 0 || p === 6;
const mine = (player: 0 | 1) => (player === 0 ? [1, 2, 3, 4, 5] : [7, 8, 9, 10, 11]);

const fresh = (): S => ({
  stones: [0, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5],
  quan: [true, false, false, false, false, false, true, false, false, false, false, false],
  scores: [0, 0],
  turn: 0,
  over: false,
});
const val = (s: S, p: number) => s.stones[p] + (s.quan[p] ? 10 : 0);

/** Play pit `i` in direction `dir` (+1 or -1). Returns the new state and the points won. */
function play(s0: S, i: number, dir: 1 | -1): { s: S; gain: number } {
  const s: S = { ...s0, stones: [...s0.stones], quan: [...s0.quan], scores: [...s0.scores] as [number, number] };
  let hand = s.stones[i];
  s.stones[i] = 0;
  let pos = i;
  let gain = 0;
  for (let guard = 0; guard < 300; guard++) {
    while (hand > 0) {
      pos = mod(pos + dir);
      s.stones[pos]++;
      hand--;
    }
    const next = mod(pos + dir);
    if (val(s, next) > 0) {
      if (isQuanPit(next)) break; // cannot pick up from a quan pit: turn ends
      hand = s.stones[next];
      s.stones[next] = 0;
      pos = next;
      continue;
    }
    // Next pit is empty: capture the pit after it, and keep capturing along the chain.
    let e = next;
    let c = mod(e + dir);
    while (val(s, c) > 0 && val(s, e) === 0) {
      gain += val(s, c);
      s.stones[c] = 0;
      s.quan[c] = false;
      e = mod(c + dir);
      c = mod(e + dir);
    }
    break;
  }
  s.scores[s.turn] += gain;
  return { s, gain };
}

function finish(s: S): S {
  const bothQuanGone = !s.quan[0] && !s.quan[6];
  if (!bothQuanGone) return s;
  const out = { ...s, scores: [...s.scores] as [number, number], stones: [...s.stones], over: true };
  ([0, 1] as const).forEach((p) => mine(p).forEach((k) => { out.scores[p] += out.stones[k]; out.stones[k] = 0; }));
  return out;
}

/** Hand over the turn; a player with an empty side borrows 5 points to place one stone per pit. */
function nextTurn(s: S): S {
  const other = (s.turn === 0 ? 1 : 0) as 0 | 1;
  const out: S = { ...s, turn: other, stones: [...s.stones], scores: [...s.scores] as [number, number] };
  if (mine(other).every((k) => out.stones[k] === 0)) {
    if (out.scores[other] >= 5) {
      out.scores[other] -= 5;
      mine(other).forEach((k) => (out.stones[k] = 1));
    } else {
      // Cannot continue: the opponent keeps the rest.
      const rival = s.turn;
      mine(rival).forEach((k) => { out.scores[rival] += out.stones[k]; out.stones[k] = 0; });
      out.over = true;
    }
  }
  return out;
}

function bestMove(s: S) {
  let best: { pit: number; dir: 1 | -1; gain: number } | null = null;
  for (const pit of mine(s.turn)) {
    if (!s.stones[pit]) continue;
    for (const dir of [1, -1] as const) {
      const { gain } = play(s, pit, dir);
      if (!best || gain > best.gain) best = { pit, dir, gain };
    }
  }
  return best;
}

export default function OAnQuan() {
  const { t } = useTranslation();
  const [s, setS] = useState<S>(fresh);
  const [pit, setPit] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const startRound = useStartRound('oan');
  const begin = async (): Promise<string | void> => {
    const r = await startRound();
    if (!r.ok) return r.message;
    setS(fresh());
    setPit(null);
    setLive(true);
  };

  const move = (dir: 1 | -1) => {
    if (pit === null) return;
    const { s: played } = play(s, pit, dir);
    const done = finish(played);
    setS(done.over ? done : nextTurn(done));
    setPit(null);
  };

  const suggestion = useMemo(() => (s.over ? null : bestMove(s)), [s]);
  const hintContext = `Ô ăn quan. Player ${s.turn + 1} to move. Pits 0..11 stones: [${s.stones.join(',')}], quan present at pits 0 and 6: [${s.quan[0]},${s.quan[6]}]. Scores: ${s.scores.join(' - ')}. Engine suggestion: pit ${suggestion?.pit}, direction ${suggestion?.dir === 1 ? 'clockwise (increasing index)' : 'counter-clockwise'}, expected gain ${suggestion?.gain}.`;
  const fallback = suggestion ? t('games.oanSuggest', { pit: suggestion.pit, dir: suggestion.dir === 1 ? '↻' : '↺', gain: suggestion.gain }) : undefined;

  if (!live) return <StartCard title={t('games.oan')} onStart={begin} />;

  // Layout: top row shows pits 11..7 left to right, bottom row 1..5.
  const top = [11, 10, 9, 8, 7];
  const bottom = [1, 2, 3, 4, 5];
  const cell = (p: number) => {
    const own = mine(s.turn).includes(p);
    const canPick = !s.over && own && s.stones[p] > 0;
    return (
      <button
        key={p}
        disabled={!canPick}
        aria-label={`${p}: ${s.stones[p]}`}
        aria-pressed={pit === p}
        onClick={() => setPit(p)}
        className={cn(
          'flex aspect-square flex-col items-center justify-center rounded-theme border-2 text-xl font-bold',
          pit === p ? 'border-accent bg-accent text-accent-fg' : canPick ? 'border-accent bg-bg hover:brightness-110' : 'border-border bg-bg opacity-80',
        )}
      >
        {s.stones[p]}
      </button>
    );
  };
  const quanCell = (p: number) => (
    <div className="row-span-2 flex flex-col items-center justify-center rounded-full border-2 border-fruit bg-bg font-bold" aria-label={`quan ${p}`}>
      <span className="text-2xl">{s.quan[p] ? '👑' : '·'}</span>
      <span>{s.stones[p]}</span>
    </div>
  );

  return (
    <div className="card flex flex-col gap-4">
      <p className="font-semibold" aria-live="polite">
        {s.over ? (s.scores[0] === s.scores[1] ? t('games.draw') : t('games.winner', { name: t(s.scores[0] > s.scores[1] ? 'games.p1' : 'games.p2') })) : t('games.yourTurn', { name: t(s.turn === 0 ? 'games.p1' : 'games.p2') })}
        {' · '}{t('games.p1')} {s.scores[0]} – {s.scores[1]} {t('games.p2')}
      </p>
      <div className="grid grid-cols-[1.3fr_repeat(5,1fr)_1.3fr] gap-2">
        {quanCell(0)}
        {top.map(cell)}
        {quanCell(6)}
        {bottom.map(cell)}
      </div>
      <p className="text-sm text-muted">{t('games.oanRules')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pit === null} onClick={() => move(-1)}><RotateCcw size={18} /> {t('games.left')}</Button>
        <Button variant="outline" disabled={pit === null} onClick={() => move(1)}><RotateCw size={18} /> {t('games.right')}</Button>
        <Button variant="ghost" onClick={begin}>{t('games.newGame')}</Button>
      </div>
      {!s.over && <HintButton game="Ô ăn quan" context={hintContext} fallback={fallback} />}
    </div>
  );
}
