'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui';
import MemoryGame from './MemoryGame';
import ChoreWheel from './ChoreWheel';
import OAnQuan from './OAnQuan';
import WordTrivia from './WordTrivia';

const GAMES = [
  { id: 'memory', C: MemoryGame },
  { id: 'wheel', C: ChoreWheel },
  { id: 'trivia', C: WordTrivia },
  { id: 'oan', C: OAnQuan },
] as const;

export default function Games() {
  const { t } = useTranslation();
  const [id, setId] = useState<(typeof GAMES)[number]['id']>('memory');
  const Active = GAMES.find((g) => g.id === id)!.C;
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">{t('games.title')}</h2>
        <p className="text-muted">{t('games.subtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {GAMES.map((g) => (
          <button key={g.id} aria-pressed={id === g.id} onClick={() => setId(g.id)} className={cn('min-h-[44px] rounded-theme border-2 px-4 font-semibold', id === g.id ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-card')}>
            {t(`games.${g.id}`)}
          </button>
        ))}
      </div>
      <Active />
    </section>
  );
}
