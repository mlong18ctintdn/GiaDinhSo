'use client';
import { useEffect, useState } from 'react';
import { Bell, HeartPulse, Landmark, Loader2, MinusCircle, Pill, Plus, ShieldAlert, ThumbsUp, Trash2, Users, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, post, ApiError } from '@/lib/api';
import { playAlarm, unlockAudio } from '@/lib/alarm';
import { useApp } from '@/lib/store';
import type { Reminder, Repeat } from '@/lib/types';
import { Button } from '../ui';

const SCAMS = [
  { id: 'deepfake', Icon: Video },
  { id: 'bank', Icon: Landmark },
  { id: 'police', Icon: ShieldAlert },
] as const;
const QUICK = [
  { id: 'Medicine', Icon: Pill },
  { id: 'Bp', Icon: HeartPulse },
  { id: 'Dinner', Icon: Users },
] as const;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function SafetyReminders() {
  return (
    <div className="flex flex-col gap-8">
      <ScamCards />
      <Reminders />
    </div>
  );
}

function ScamCards() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="scam-title" className="flex flex-col gap-3">
      <div>
        <h2 id="scam-title" className="text-xl font-bold">{t('safety.title')}</h2>
        <p className="text-sm text-muted">{t('safety.subtitle')}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {SCAMS.map(({ id, Icon }) => (
          <article key={id} className="card flex flex-col gap-3 !p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-theme bg-[#d92d2d] text-white" aria-hidden>
                <Icon size={22} />
              </span>
              <div>
                <span className="rounded-full bg-[#d92d2d] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white">{t('safety.risk')}</span>
                <h3 className="mt-1 font-bold leading-snug">{t(`scam.${id}.title`)}</h3>
              </div>
            </div>
            <p className="text-sm text-muted">{t(`scam.${id}.desc`)}</p>
            <div className="rounded-theme bg-[#dcf5e8] p-3 text-[#143d28]">
              <p className="mb-1 flex items-center gap-1 font-bold text-[#16794a]"><ThumbsUp size={16} aria-hidden /> {t('safety.do')}</p>
              <ul className="space-y-1 text-sm">
                <li>✓ {t(`scam.${id}.do1`)}</li>
                <li>✓ {t(`scam.${id}.do2`)}</li>
              </ul>
            </div>
            <div className="rounded-theme bg-[#fde2e2] p-3 text-[#5c1a1a]">
              <p className="mb-1 flex items-center gap-1 font-bold text-[#c2262e]"><MinusCircle size={16} aria-hidden /> {t('safety.dont')}</p>
              <ul className="space-y-1 text-sm">
                <li>✕ {t(`scam.${id}.dont1`)}</li>
                <li>✕ {t(`scam.${id}.dont2`)}</li>
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Reminders() {
  const { t } = useTranslation();
  const { code, members, memberId, reminders, setReminders } = useApp();
  const [text, setText] = useState('');
  const [time, setTime] = useState('08:00');
  const [repeat, setRepeat] = useState<Repeat>('daily');
  const [date, setDate] = useState(today());
  const [target, setTarget] = useState<string>(memberId ?? 'all');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !code) return;
    setBusy(true);
    setErr('');
    try {
      const r = await post<{ reminder: Reminder }>('/api/reminders', {
        code,
        text,
        remind_time: time,
        repeat,
        once_date: repeat === 'once' ? date : null,
        member_id: target === 'all' ? null : target,
        created_by: memberId,
      });
      setReminders([...reminders.filter((x) => x.id !== r.reminder.id), r.reminder]);
      setText('');
    } catch (e) {
      const why = e instanceof ApiError ? e.detail || e.message : '';
      setErr(why ? `${t('common.error')} (${why})` : t('common.error'));
    }
    setBusy(false);
  }

  async function remove(id: string | number) {
    setReminders(reminders.filter((r) => r.id !== id));
    try {
      await api(`/api/reminders?code=${code}&id=${id}`, { method: 'DELETE' });
    } catch {
      /* the next sync restores it if the delete failed */
    }
  }

  async function askPermission() {
    if (typeof Notification !== 'undefined') setPerm(await Notification.requestPermission());
  }

  const sorted = [...reminders].sort((a, b) => a.remind_time.localeCompare(b.remind_time));
  const who = (r: Reminder) => members.find((m) => m.id === r.member_id);

  return (
    <section aria-labelledby="rem-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rem-title" className="text-xl font-bold">{t('reminders.title')}</h2>
        <Button variant="outline" onClick={() => { unlockAudio(); playAlarm(); }}>
          <Bell size={18} /> {t('reminders.testSound')}
        </Button>
      </div>

      <form onSubmit={add} className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{t('reminders.quick')}</span>
          {QUICK.map(({ id, Icon }) => (
            <Button key={id} type="button" variant="outline" className="!min-h-[40px] !py-1.5" onClick={() => setText(t(`reminders.quick${id}`))}>
              <Icon size={16} /> {t(`reminders.quick${id}`)}
            </Button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className="field" value={text} maxLength={100} onChange={(e) => setText(e.target.value)} placeholder={t('reminders.textPlaceholder')} aria-label={t('reminders.textPlaceholder')} />
          <input className="field sm:w-36" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={t('reminders.time')} required />
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="field !w-auto" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} aria-label={t('reminders.repeat')}>
            <option value="daily">{t('reminders.daily')}</option>
            <option value="weekdays">{t('reminders.weekdays')}</option>
            <option value="once">{t('reminders.once')}</option>
          </select>
          {repeat === 'once' && <input className="field !w-auto" type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} aria-label={t('reminders.date')} required />}
          <select className="field !w-auto" value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t('reminders.for')}>
            <option value="all">{t('reminders.for')}: {t('reminders.everyone')}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{t('reminders.for')}: {m.name}</option>
            ))}
          </select>
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} {t('reminders.add')}
          </Button>
        </div>
        {err && <p role="alert" className="font-semibold text-red-600">{err}</p>}
      </form>

      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {t('reminders.openNote')}
        {perm === 'default' && <button onClick={askPermission} className="font-semibold text-accent underline">{t('reminders.enableNotif')}</button>}
        {perm === 'granted' && <span>{t('reminders.notifOn')}</span>}
        {perm === 'denied' && <span>{t('reminders.notifBlocked')}</span>}
      </p>

      {sorted.length === 0 ? (
        <p className="card text-center text-muted">{t('reminders.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((r) => (
            <li key={r.id} className="card flex items-center gap-3 !p-3">
              <span className="rounded-theme bg-accent px-3 py-1 text-lg font-bold text-accent-fg">{r.remind_time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.text}</p>
                <p className="text-sm text-muted">
                  {t(`reminders.${r.repeat}`)}{r.repeat === 'once' && r.once_date ? ` · ${r.once_date}` : ''} · {who(r) ? `${who(r)!.avatar ?? ''} ${who(r)!.name}` : t('reminders.everyone')}
                </p>
              </div>
              <button onClick={() => remove(r.id)} aria-label={t('reminders.delete')} className="rounded-full p-2 hover:bg-bg"><Trash2 size={18} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
