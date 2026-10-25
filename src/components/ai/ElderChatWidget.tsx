'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Check, Clock, HeartHandshake, Loader2, RotateCcw, Send, Volume2, VolumeX, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiError, PaywallError, post } from '@/lib/api';
import { careKind, dueNow } from '@/lib/ai/elder';
import { useApp, useMe } from '@/lib/store';
import { getWeatherSummary } from '@/lib/weather';
import VoiceButton from '../VoiceButton';

interface Msg { id: string; role: 'user' | 'assistant'; text: string }
const SPEECH: Record<string, string> = { vi: 'vi-VN', zh: 'zh-CN', en: 'en-US', es: 'es-ES' };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const clockNow = () => {
  const d = new Date();
  return { hhmm: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, date: ymd(d), weekday: d.getDay() };
};
const uid = () => Math.random().toString(36).slice(2, 10);
const WEATHER_WORDS = /thời tiết|nắng|mưa|nóng|lạnh|weather|天气|clima|tiempo/i;
const EXERCISE_TIP = 'Mình ngồi thẳng lưng, hít vào thật sâu ba lần, rồi xoay vai nhẹ nhàng năm vòng nhé.';

/**
 * Floating companion for grandparents ("Cháu Ngoan"): big type, warm colours, one-tap suggestions, read-aloud,
 * and it gently brings up the family's medicine / exercise reminders.
 */
export default function ElderChatWidget() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const { code, memberId, reminders, acks, ackReminder } = useApp();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [snooze, setSnooze] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);
  const prompted = useRef<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const storeKey = `gds-chat-${memberId}`;

  const dear = !me ? '' : i18n.language !== 'vi' ? me.name : me.avatar === '👴' ? 'ông' : me.avatar === '👵' ? 'bà' : 'bác';

  // Remember the last conversation on this device (try/catch: private mode can forbid storage).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? '[]') as Msg[];
      setMsgs(saved.length ? saved : []);
    } catch { setMsgs([]); }
  }, [storeKey]);
  useEffect(() => {
    try { localStorage.setItem(storeKey, JSON.stringify(msgs.slice(-24))); } catch { /* ignore */ }
  }, [msgs, storeKey]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000); // re-check reminders twice a minute
    return () => clearInterval(id);
  }, []);

  const doneIds = useMemo(() => new Set(Object.keys(acks).filter((k) => k.endsWith(`|${ymd(new Date())}`)).map((k) => k.split('|')[0])), [acks, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reminders that are due now for THIS person (the list comes from /api/reminders via the family sync).
  const pending = useMemo(() => {
    if (!memberId) return [];
    const nowMs = Date.now();
    return dueNow(reminders, memberId, clockNow(), doneIds).filter((d) => d.min <= 15 && d.min >= -60 && (snooze[d.id] ?? 0) < nowMs);
  }, [reminders, memberId, doneIds, snooze, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = useCallback((m: Omit<Msg, 'id'>) => setMsgs((old) => [...old, { ...m, id: uid() }]), []);

  // The first time a medicine or exercise reminder comes due, the companion says it in the chat (no AI call, no cost).
  useEffect(() => {
    for (const d of pending) {
      const key = `${d.id}|${ymd(new Date())}|${d.time}`;
      if (prompted.current.has(key) || d.kind === 'other') continue;
      prompted.current.add(key);
      say({ role: 'assistant', text: d.kind === 'medicine' ? t('elder.medicineNudge', { dear, text: d.text }) : `${t('elder.exerciseNudge', { dear, text: d.text })} ${EXERCISE_TIP}` });
    }
  }, [pending, dear, say, t]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);
  useEffect(() => () => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); }, []);

  function speak(m: Msg) {
    if (!('speechSynthesis' in window)) return;
    if (speakingId === m.id) { window.speechSynthesis.cancel(); setSpeakingId(null); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(m.text);
    u.lang = SPEECH[i18n.language] ?? 'vi-VN';
    u.rate = 0.9; // a little slower for easy listening
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(m.id);
    window.speechSynthesis.speak(u);
  }

  async function send(raw: string) {
    const msg = raw.trim().slice(0, 500);
    if (!msg || busy || !code || !memberId) return;
    setText('');
    const mine: Msg = { id: uid(), role: 'user', text: msg };
    const all = [...msgs, mine];
    setMsgs(all);
    setBusy(true);
    try {
      const weather = WEATHER_WORDS.test(msg) ? await getWeatherSummary() : null;
      // The AI needs a conversation that starts with the person and alternates: tidy it here.
      const turns: Omit<Msg, 'id'>[] = [];
      for (const m of all.slice(-14)) {
        if (!turns.length && m.role === 'assistant') continue;
        const last = turns[turns.length - 1];
        if (last && last.role === m.role) last.text += `\n${m.text}`;
        else turns.push({ role: m.role, text: m.text });
      }
      const r = await post<{ reply: string }>('/api/ai/chat', {
        code, member_id: memberId, locale: i18n.language, clock: clockNow(), weather: weather ?? undefined,
        done: [...doneIds], messages: turns,
      });
      say({ role: 'assistant', text: r.reply });
    } catch (e) {
      const key = e instanceof ApiError ? e.message : '';
      say({ role: 'assistant', text: e instanceof PaywallError ? t('elder.limit', { dear }) : key === 'ai_not_configured' ? t('elder.aiOff') : key === 'slow_down' ? t('elder.slow', { dear }) : t('elder.error', { dear }) });
    }
    setBusy(false);
  }

  if (!me || !code) return null;
  const chips = ['weather', 'story', 'tired', 'today', 'lonely'] as const;

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label={t('elder.title')}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            style={{ transformOrigin: 'bottom right' }}
            className="pointer-events-auto mb-3 flex h-[min(42rem,calc(100dvh-6.5rem))] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.5rem] border-[3px] border-[#1f5c3f] bg-[#fff8e8] text-[#231707] shadow-2xl"
          >
            <header className="flex items-center gap-3 bg-[#1f5c3f] px-4 py-3 text-white">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#fff8e8] text-3xl" aria-hidden>🧡</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-extrabold leading-tight">{t('elder.title')}</h2>
                <p className="text-sm leading-tight text-white/85">{t('elder.subtitle')}</p>
              </div>
              <button onClick={() => { setMsgs([]); window.speechSynthesis?.cancel(); }} aria-label={t('elder.clear')} title={t('elder.clear')} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/15"><RotateCcw size={22} /></button>
              <button onClick={() => setOpen(false)} aria-label={t('elder.close')} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/15"><X size={26} /></button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
              {pending.map((d) => (
                <div key={d.id} className="rounded-2xl border-[3px] border-[#d9822b] bg-[#ffecc8] p-3">
                  <p className="flex items-center gap-2 text-lg font-extrabold"><BellRing size={22} className="text-[#b45f10]" aria-hidden /> {t('elder.reminderNow', { text: d.text })}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => { ackReminder(d.id); say({ role: 'assistant', text: t('elder.reminderThanks', { dear }) }); }} className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#1f5c3f] px-4 text-lg font-bold text-white"><Check size={20} /> {t('elder.reminderDone')}</button>
                    <button onClick={() => setSnooze((s) => ({ ...s, [d.id]: Date.now() + 15 * 60_000 }))} className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-2 border-[#1f5c3f] px-4 text-lg font-bold text-[#1f5c3f]"><Clock size={20} /> {t('elder.reminderLater')}</button>
                  </div>
                </div>
              ))}

              {msgs.length === 0 && (
                <div className="rounded-2xl bg-white p-4 text-xl leading-snug shadow-sm">
                  <p>{t('elder.greeting', { dear, name: me.name })}</p>
                </div>
              )}

              {msgs.map((m) => (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={m.role === 'user' ? 'max-w-[88%] rounded-2xl rounded-br-md bg-[#1f5c3f] px-4 py-3 text-xl leading-snug text-white' : 'max-w-[92%] rounded-2xl rounded-bl-md border-2 border-[#c9b68e] bg-white px-4 py-3 text-xl leading-snug'}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.role === 'assistant' && 'speechSynthesis' in globalThis && (
                      <button onClick={() => speak(m)} className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-[#1f5c3f] px-3 text-base font-bold text-[#1f5c3f]">
                        {speakingId === m.id ? <VolumeX size={20} /> : <Volume2 size={20} />} {speakingId === m.id ? t('elder.stopListen') : t('elder.listen')}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start" role="status" aria-label={t('elder.thinking')}>
                  <div className="flex items-center gap-1.5 rounded-2xl border-2 border-[#c9b68e] bg-white px-4 py-4">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="h-3 w-3 rounded-full bg-[#1f5c3f]" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }} />
                    ))}
                    <span className="sr-only">{t('elder.thinking')}</span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="border-t-2 border-[#c9b68e] bg-[#f6ecd6] p-3">
              <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t('elder.suggestions')}>
                {chips.map((c) => (
                  <button key={c} disabled={busy} onClick={() => send(t(`elder.chips.${c}`))} className="min-h-[48px] shrink-0 rounded-full border-2 border-[#1f5c3f] bg-white px-4 text-lg font-bold text-[#1f5c3f] hover:bg-[#1f5c3f] hover:text-white disabled:opacity-50">
                    {t(`elder.chips.${c}`)}
                  </button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={500}
                  placeholder={t('elder.placeholder')}
                  aria-label={t('elder.placeholder')}
                  className="min-h-[56px] min-w-0 flex-1 rounded-full border-[3px] border-[#c9b68e] bg-white px-4 text-xl text-[#231707] outline-none placeholder:text-[#7a6540] focus:border-[#1f5c3f]"
                />
                <VoiceButton onText={(v) => setText((old) => `${old} ${v}`.trim())} />
                <button type="submit" disabled={busy || !text.trim()} aria-label={t('elder.send')} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#1f5c3f] text-white disabled:opacity-40">
                  {busy ? <Loader2 className="animate-spin" size={26} /> : <Send size={26} />}
                </button>
              </form>
              <p className="mt-2 text-xs leading-snug text-[#594526]">{t('elder.disclaimer')}</p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          key="launcher"
          onClick={() => setOpen(true)}
          aria-label={t('elder.open')}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="pointer-events-auto relative flex min-h-[64px] items-center gap-3 rounded-full border-[3px] border-[#fff8e8] bg-[#1f5c3f] py-2 pl-3 pr-5 text-xl font-extrabold text-white shadow-2xl"
        >
          <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }} className="grid h-12 w-12 place-items-center rounded-full bg-[#fff8e8] text-[#1f5c3f]">
            <HeartHandshake size={28} aria-hidden />
          </motion.span>
          <span className="hidden sm:inline">{t('elder.open')}</span>
          <span className="sm:hidden">{t('elder.openShort')}</span>
          {pending.length > 0 && (
            <motion.span animate={{ rotate: [0, -14, 14, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 1.6, repeatDelay: 1.2 }} className="absolute -right-1 -top-2 grid h-9 w-9 place-items-center rounded-full bg-[#d9822b] text-white" aria-label={t('elder.reminderBadge')}>
              <BellRing size={20} />
            </motion.span>
          )}
        </motion.button>
      )}
    </div>
  );
}
