'use client';
import { useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { post, PaywallError } from '@/lib/api';
import { useApp } from '@/lib/store';
import { Button } from '../ui';

/**
 * AI hint for any game. Costs one free operation. If the AI is not configured
 * or fails, the free local `fallback` hint is shown instead (and nothing is charged).
 */
export default function HintButton({ game, context, fallback }: { game: string; context: string; fallback?: string }) {
  const { t, i18n } = useTranslation();
  const { code } = useApp();
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      const r = await post<{ hint: string }>('/api/ai/hint', { code, game, context, locale: i18n.language });
      setHint(r.hint);
    } catch (e) {
      if (!(e instanceof PaywallError)) setHint(fallback ?? t('games.hintError'));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={ask} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" size={18} /> : <Lightbulb size={18} />} {t('games.hint')}
      </Button>
      {hint && <p aria-live="polite" className="rounded-theme border-2 border-accent p-3">{hint}</p>}
    </div>
  );
}
