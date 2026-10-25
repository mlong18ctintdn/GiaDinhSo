'use client';
import { useMemo, useState } from 'react';
import { Loader2, Search, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { post, PaywallError, ApiError } from '@/lib/api';
import { useDictionary } from '@/hooks/useDictionary';
import { useApp } from '@/lib/store';
import { Button } from '../ui';
import VoiceButton from '../VoiceButton';

interface AiResult {
  meaning: string;
  psychology: string;
  empathy: string;
  replies: string[];
  avoid: string[];
}
const PAGE = 30;

export default function GenZDecoder() {
  const { t, i18n } = useTranslation();
  const { words, loading } = useDictionary(i18n.language);
  const { code } = useApp();
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);

  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? words.filter((w) => w.word.toLowerCase().includes(s) || w.definition.toLowerCase().includes(s)) : words;
  }, [q, words]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!phrase.trim()) return;
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const r = await post<{ result: AiResult }>('/api/ai/decode', { code, phrase, locale: i18n.language });
      setResult(r.result);
    } catch (e) {
      if (!(e instanceof PaywallError)) {
        const base = e instanceof Error && e.message === 'ai_not_configured' ? t('decoder.aiNotConfigured') : t('decoder.aiError');
        setErr(e instanceof ApiError && e.detail && e.message !== 'ai_not_configured' ? `${base} (${e.detail})` : base);
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="ask-title" className="card flex flex-col gap-3">
        <h2 id="ask-title" className="flex items-center gap-2 text-xl font-bold">
          <Sparkles size={20} className="text-accent" /> {t('decoder.askTitle')}
        </h2>
        <p className="text-muted">{t('decoder.askHint')}</p>
        <form onSubmit={ask} className="flex flex-col gap-3">
          <textarea className="field min-h-24" value={phrase} maxLength={500} onChange={(e) => setPhrase(e.target.value)} placeholder={t('decoder.askPlaceholder')} aria-label={t('decoder.askTitle')} />
          <div className="flex flex-wrap gap-2">
            <VoiceButton onText={(txt) => setPhrase((p) => (p ? `${p} ${txt}` : txt))} />
            <Button type="submit" disabled={busy || !phrase.trim()}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} {t('decoder.ask')}
            </Button>
          </div>
        </form>
        {err && <p role="alert" className="font-semibold text-red-600">{err}</p>}
        {result && (
          <div className="flex flex-col gap-3 rounded-theme border-2 border-accent p-4" aria-live="polite">
            <Block title={t('decoder.meaning')}>{result.meaning}</Block>
            <Block title={t('decoder.psychology')}>{result.psychology}</Block>
            <Block title={t('decoder.empathy')}>{result.empathy}</Block>
            <div>
              <h3 className="font-bold">{t('decoder.replies')}</h3>
              <ul className="ml-5 list-disc space-y-1">{result.replies?.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
            <div>
              <h3 className="font-bold">{t('decoder.avoid')}</h3>
              <ul className="ml-5 list-disc space-y-1">{result.avoid?.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="dict-title" className="flex flex-col gap-3">
        <div>
          <h2 id="dict-title" className="text-xl font-bold">{t('decoder.title')}</h2>
          <p className="text-muted">{t('decoder.subtitle', { n: words.length })}</p>
        </div>
        <label className="relative block">
          <span className="sr-only">{t('decoder.search')}</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field !pl-10" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={t('decoder.search')} />
        </label>
        {loading && <p className="text-muted">{t('common.loading')}</p>}
        {!loading && found.length === 0 && <p className="text-muted">{t('decoder.noResults')}</p>}
        <ul className="flex flex-col gap-3">
          {found.slice(0, limit).map((w) => (
            <li key={w.word} className="card flex flex-col gap-2">
              <h3 className="text-lg font-bold">{w.word}</h3>
              <p>{w.definition}</p>
              <p className="rounded-theme bg-bg p-3"><b>{t('decoder.solution')}: </b>{w.solution_for_parents}</p>
              <p className="text-sm italic text-muted">{t('decoder.example')}: {w.context_example}</p>
            </li>
          ))}
        </ul>
        {found.length > limit && <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>{t('decoder.more')}</Button>}
      </section>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      <p>{children}</p>
    </div>
  );
}
