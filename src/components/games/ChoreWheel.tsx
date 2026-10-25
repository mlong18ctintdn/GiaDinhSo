'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, PartyPopper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiError, post } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useGameState, type GameReply } from '@/hooks/useGameState';
import { toast } from '@/lib/toast';
import { useApp } from '@/lib/store';
import { angleAt, IDLE_WHEEL, type WheelMember, type WheelState } from '@/lib/wheel';
import { Button, Modal } from '../ui';

const COLORS = ['#ec4899', '#f97316', '#8b5cf6', '#10b981', '#0ea5e9', '#eab308', '#ef4444', '#14b8a6'];
const R = 150;
const polar = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180; // 0 degrees = top, clockwise
  return [r * Math.cos(a), r * Math.sin(a)];
};
function sector(i: number, n: number) {
  const [x0, y0] = polar((i * 360) / n, R);
  const [x1, y1] = polar(((i + 1) * 360) / n, R);
  return `M0 0 L${x0} ${y0} A${R} ${R} 0 ${n <= 2 ? 0 : 0} 1 ${x1} ${y1} Z`;
}

/** Wheel of Chores. One person spins, the server picks, and every screen shows the same spin at the same moment. */
export default function ChoreWheel() {
  const { t } = useTranslation();
  const { code, memberId, members } = useApp();
  const { state, apply, now } = useGameState<WheelState>('wheel', IDLE_WHEEL);
  const [chore, setChore] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [angle, setAngle] = useState(0);
  const [finished, setFinished] = useState(true);
  const [showWinner, setShowWinner] = useState(false);
  const announced = useRef<string | null>(null);
  const spin = state.spin;

  useEffect(() => {
    if (!spin) {
      setAngle(0);
      setFinished(true);
      return;
    }
    let raf = 0;
    const frame = () => {
      setAngle(angleAt(spin, now()));
      const over = now() >= spin.startedAt + spin.duration;
      setFinished(over);
      if (!over) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [spin?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The moment a spin ends: pop up the winner and show a toast, on EVERY device watching the wheel.
  useEffect(() => {
    if (!spin || !finished || announced.current === spin.id) return;
    const firstLook = announced.current === null; // page just opened
    announced.current = spin.id;
    const w = spin.members[spin.winnerIndex];
    const endedAgo = now() - (spin.startedAt + spin.duration);
    if (!w || (firstLook && endedAgo > 8000) || endedAgo > 15000) return; // an old result is not news
    setShowWinner(true);
    toast({ emoji: w.avatar ?? '🎉', title: t('games.wheelWinnerToast', { name: w.name }), body: spin.chore || undefined, tone: 'success' }, 7000);
  }, [spin?.id, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const sectors: WheelMember[] = spin ? spin.members : members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar }));
  const n = sectors.length;

  async function go() {
    setBusy(true);
    setMsg('');
    try {
      apply(await post<GameReply<WheelState>>('/api/games/wheel', { code, member_id: memberId, chore }));
    } catch (e) {
      const key = e instanceof ApiError ? e.message : '';
      if (e instanceof ApiError && e.body?.state) apply(e.body);
      setMsg(key === 'spinning' ? t('games.busy') : key === 'need_members' ? t('games.needMembers') : explainError(e, t));
    }
    setBusy(false);
  }

  const winner = spin && finished ? spin.members[spin.winnerIndex] : null;
  const confetti = ['🎉', '✨', '🎊', '⭐', '🌟', '🎈'];

  return (
    <div className="card flex flex-col items-center gap-4">
      <p className="text-center text-muted">{t('games.choreHint')}</p>
      {n < 2 ? (
        <p className="py-8 text-center font-semibold">{t('games.needMembers')}</p>
      ) : (
        <svg viewBox="-165 -180 330 345" className="w-full max-w-sm" role="img" aria-label={t('games.wheel')}>
          <g transform={`rotate(${angle})`}>
            {sectors.map((m, i) => {
              const [lx, ly] = polar(((i + 0.5) * 360) / n, R * 0.62);
              return (
                <g key={m.id}>
                  <path d={sector(i, n)} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={2} />
                  <text x={lx} y={ly - 4} textAnchor="middle" fontSize={22}>{m.avatar}</text>
                  <text x={lx} y={ly + 16} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">{m.name.slice(0, 10)}</text>
                </g>
              );
            })}
          </g>
          <circle r={20} fill="#fff" stroke="#374151" strokeWidth={4} />
          <polygon points="-13,-176 13,-176 0,-146" fill="var(--fg)" />
        </svg>
      )}

      <div className="min-h-[3rem] text-center text-xl font-bold" aria-live="polite">
        {winner && (spin!.chore ? `${winner.avatar ?? ''} ${winner.name}: ${spin!.chore}` : t('games.wheelResult', { name: `${winner.avatar ?? ''} ${winner.name}` }))}
        {spin && !finished && <span className="text-muted">{t('games.spinning')}</span>}
      </div>

      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <input className="field" value={chore} maxLength={60} onChange={(e) => setChore(e.target.value)} placeholder={t('games.chorePlaceholder')} aria-label={t('games.chorePlaceholder')} />
        <Button onClick={go} disabled={busy || !finished || n < 2}>
          {busy && <Loader2 className="animate-spin" size={18} />} {t('games.spin')}
        </Button>
      </div>
      <p className="text-xs text-muted">{t('games.startHint')} {t('games.live')}</p>
      {msg && <p role="alert" className="font-semibold text-red-600">{msg}</p>}

      {state.history.length > 0 && (
        <div className="w-full max-w-md">
          <h3 className="mb-1 font-bold">{t('games.history')}</h3>
          <ul className="space-y-1 text-sm">
            {state.history.map((h) => (
              <li key={h.id} className="rounded-theme bg-bg px-3 py-1.5">
                {h.avatar} <b>{h.name}</b>{h.chore ? `: ${h.chore}` : ''} · <span className="text-muted">{new Date(h.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={showWinner && !!winner} onClose={() => setShowWinner(false)} title={t('games.wheelWinnerTitle')}>
        {winner && (
          <div className="relative flex flex-col items-center gap-3 overflow-hidden py-6 text-center">
            {confetti.map((c, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="pointer-events-none absolute top-0 text-2xl"
                style={{ left: `${8 + i * 16}%` }}
                initial={{ y: -20, opacity: 0, rotate: 0 }}
                animate={{ y: 220, opacity: [0, 1, 1, 0], rotate: 160 }}
                transition={{ duration: 2.2, delay: i * 0.12, ease: 'easeIn' }}
              >
                {c}
              </motion.span>
            ))}
            <motion.div initial={{ scale: 0.3, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 8, stiffness: 160 }} className="text-8xl" aria-hidden>
              {winner.avatar ?? <PartyPopper size={80} />}
            </motion.div>
            <p className="text-3xl font-extrabold" aria-live="assertive">{winner.name}</p>
            <p className="text-xl">{spin?.chore ? t('games.wheelWinnerChore', { chore: spin.chore }) : t('games.wheelResult', { name: winner.name })}</p>
            <Button className="mt-2 w-full" onClick={() => setShowWinner(false)}>{t('games.wheelWinnerOk')}</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
