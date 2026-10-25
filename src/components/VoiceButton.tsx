'use client';
import { useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui';

const LANGS: Record<string, string> = { vi: 'vi-VN', zh: 'zh-CN', en: 'en-US', es: 'es-ES' };

/** Speech-to-text via the browser's Web Speech API. Hidden where unsupported. */
export default function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const { t, i18n } = useTranslation();
  const [on, setOn] = useState(false);
  const ref = useRef<any>(null);
  const Rec = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  if (!Rec) return null;

  function toggle() {
    if (on) return ref.current?.stop();
    const r = new Rec();
    r.lang = LANGS[i18n.language] ?? 'vi-VN';
    r.interimResults = false;
    r.onresult = (e: any) => onText(Array.from(e.results).map((x: any) => x[0].transcript).join(' '));
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    ref.current = r;
    r.start();
    setOn(true);
  }

  return (
    <Button type="button" variant="outline" onClick={toggle} aria-pressed={on}>
      {on ? <MicOff size={18} /> : <Mic size={18} />}
      {on ? t('voice.stop') : t('voice.start')}
    </Button>
  );
}
