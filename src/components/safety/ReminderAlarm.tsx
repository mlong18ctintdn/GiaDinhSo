'use client';
import { useEffect, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { playAlarm, unlockAudio } from '@/lib/alarm';
import { useApp } from '@/lib/store';
import type { Reminder } from '@/lib/types';
import { Button, Modal } from '../ui';

const SPEECH: Record<string, string> = { vi: 'vi-VN', zh: 'zh-CN', en: 'en-US', es: 'es-ES' };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Checks every 15 seconds while the page is open. A reminder fires once per day when its time
 * has passed by 0 to 2 minutes (the 2-minute window covers browsers that slow down background tabs).
 * It rings, shows a big on-screen alert, sends a browser notification if allowed,
 * and reads the text aloud for grandparents.
 */
export default function ReminderAlarm() {
  const { t, i18n } = useTranslation();
  const { reminders, memberId, members, ackReminder } = useApp();
  const me = members.find((m) => m.id === memberId);
  const [queue, setQueue] = useState<Reminder[]>([]);
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const today = ymd(now);
      const weekday = now.getDay();
      const fresh: Reminder[] = [];
      for (const r of reminders) {
        if (r.member_id && r.member_id !== memberId) continue;
        if (r.repeat === 'weekdays' && (weekday === 0 || weekday === 6)) continue;
        if (r.repeat === 'once' && r.once_date !== today) continue;
        const [h, m] = r.remind_time.split(':').map(Number);
        const late = minutes - (h * 60 + m);
        if (late < 0 || late > 2) continue;
        const key = `${r.id}|${today}|${r.remind_time}`;
        if (fired.current.has(key)) continue;
        fired.current.add(key);
        fresh.push(r);
      }
      if (!fresh.length) return;
      setQueue((q) => [...q, ...fresh]);
      playAlarm();
      for (const r of fresh) {
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(t('reminders.alertTitle'), { body: r.text });
          }
        } catch {
          /* some mobile browsers only allow notifications from a service worker */
        }
        if (me?.role === 'grandparent' && 'speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(`${t('reminders.alertTitle')}. ${r.text}`);
          u.lang = SPEECH[i18n.language] ?? 'vi-VN';
          window.speechSynthesis.speak(u);
        }
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [reminders, memberId, me?.role, t, i18n.language]);

  const current = queue[0];
  return (
    <Modal open={!!current} onClose={() => setQueue((q) => q.slice(1))} title={t('reminders.alertTitle')}>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <BellRing size={56} className="text-accent" aria-hidden />
        <p className="text-3xl font-bold" aria-live="assertive">{current?.text}</p>
        <Button onClick={() => { if (current) ackReminder(current.id); setQueue((q) => q.slice(1)); }} className="w-full">{t('reminders.done')}</Button>
      </div>
    </Modal>
  );
}
