'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Story } from '@/lib/types';
import { Button, Modal } from '../ui';

interface Page { stories: Story[]; nextCursor: string | null }

/** Side drawer with the stories of ONE year, loaded a page at a time (newest first). */
export default function StoryDrawer({ year, onClose, onAdd }: { year: number | null; onClose: () => void; onAdd: (year: number) => void }) {
  const { t, i18n } = useTranslation();
  const { code, storiesRev } = useApp();
  const [list, setList] = useState<Story[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const token = useRef(0); // ignore answers that belong to a year we already left

  const load = useCallback(
    async (cursor: string | null) => {
      if (year === null || !code) return;
      const mine = ++token.current;
      setLoading(true);
      setFailed(false);
      try {
        const r = await api<Page>(`/api/stories?code=${code}&year=${year}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        if (mine !== token.current) return;
        setList((old) => (cursor ? [...old, ...r.stories.filter((s) => !old.some((o) => o.id === s.id))] : r.stories));
        setNext(r.nextCursor);
      } catch {
        if (mine === token.current) setFailed(true);
      }
      if (mine === token.current) setLoading(false);
    },
    [year, code],
  );

  // First page when a year opens, and again when stories change (someone added one).
  useEffect(() => {
    setList([]);
    setNext(null);
    if (year !== null) void load(null);
  }, [year, storiesRev, load]);

  return (
    <Modal side open={year !== null} onClose={onClose} title={t('tree.storiesOfYear', { year })}>
      <div className="flex flex-col gap-4">
        {!loading && !failed && list.length === 0 && <p className="text-muted">{t('tree.noStories')}</p>}
        {failed && (
          <div role="alert" className="flex flex-col gap-2">
            <p className="font-semibold text-red-600">{t('common.error')}</p>
            <Button variant="outline" onClick={() => load(null)}>{t('tree.retry')}</Button>
          </div>
        )}
        {list.map((s, idx) => (
          <article key={s.id} className="card flex flex-col gap-2 !bg-bg">
            <h3 className="text-lg font-bold">{s.title}</h3>
            {s.photo_url && (
              <div className="relative h-64 w-full overflow-hidden rounded-theme bg-card">
                <Image src={s.photo_url} alt={s.title} fill sizes="(max-width: 640px) 100vw, 512px" quality={70} className="object-cover" priority={idx === 0} />
              </div>
            )}
            {s.content && <p className="whitespace-pre-wrap">{s.content}</p>}
            {s.audio_url && <audio controls src={s.audio_url} className="w-full" preload="none" />}
            <p className="text-sm text-muted">
              {t('tree.by', { name: s.author_name })} · {new Date(s.created_at).toLocaleDateString(i18n.language)}
            </p>
          </article>
        ))}
        {loading && (
          <p className="flex items-center justify-center gap-2 py-4 text-muted" role="status">
            <Loader2 className="animate-spin" size={18} /> {t('tree.loading')}
          </p>
        )}
        {next && !loading && <Button variant="outline" onClick={() => load(next)}>{t('tree.loadMore')}</Button>}
        {year !== null && (
          <Button onClick={() => onAdd(year)}>
            <Plus size={18} /> {t('tree.addToYear', { year })}
          </Button>
        )}
      </div>
    </Modal>
  );
}
