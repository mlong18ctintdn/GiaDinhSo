'use client';
import { useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui';

/**
 * Every round starts here. Starting costs one free use, so it is said out loud.
 * `onStart` returns an error message to show, or nothing when it worked.
 */
export default function StartCard({ title, onStart }: { title: string; onStart: () => Promise<string | void> | string | void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lock = useRef(false); // a fast double click must not start two rounds
  return (
    <div className="card flex flex-col items-center gap-3 py-8 text-center">
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-sm text-muted">{t('games.startHint')}</p>
      <Button
        disabled={busy}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setErr('');
          setErr((await onStart()) || '');
          setBusy(false);
          lock.current = false;
        }}
      >
        {busy ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />} {t('games.start')}
      </Button>
      {err && <p role="alert" className="max-w-md text-sm font-semibold text-red-600">{err}</p>}
    </div>
  );
}
