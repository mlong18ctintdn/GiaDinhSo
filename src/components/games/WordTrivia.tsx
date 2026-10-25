'use client';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDictionary } from '@/hooks/useDictionary';
import type { GenZWord } from '@/lib/types';
import { Button, cn } from '../ui';
import { useStartRound } from '@/hooks/useStartRound';
import HintButton from './HintButton';
import StartCard from './StartCard';

const ROUNDS = 8;
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

interface Q {
  word: GenZWord;
  options: string[];
}

function makeQuiz(words: GenZWord[]): Q[] {
  return shuffle(words)
    .slice(0, ROUNDS)
    .map((w) => ({
      word: w,
      options: shuffle([w.definition, ...shuffle(words.filter((x) => x.word !== w.word)).slice(0, 3).map((x) => x.definition)]),
    }));
}

/** Teens quiz their parents on slang, and the other way round. Questions come from the dictionary. */
export default function WordTrivia() {
  const { t, i18n } = useTranslation();
  const { words } = useDictionary(i18n.language);
  const [quiz, setQuiz] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const start = useCallback(() => {
    setQuiz(makeQuiz(words));
    setI(0);
    setPicked(null);
    setScore(0);
  }, [words]);
  const startRound = useStartRound('trivia');
  const begin = useCallback(async (): Promise<string | void> => {
    if (words.length < 4) return t('common.loading');
    const r = await startRound();
    if (!r.ok) return r.message;
    start();
  }, [words, startRound, start, t]);

  if (!quiz.length) return <StartCard title={t('games.trivia')} onStart={begin} />;
  if (i >= quiz.length) {
    return (
      <div className="card flex flex-col items-center gap-3 text-center">
        <p className="text-2xl font-bold">{t('games.score', { score, total: quiz.length })}</p>
        <Button onClick={begin}>{t('games.newGame')}</Button>
      </div>
    );
  }
  const q = quiz[i];

  return (
    <div className="card flex flex-col gap-4">
      <p className="text-sm text-muted">{t('games.question', { n: i + 1, total: quiz.length })}</p>
      <h3 className="text-2xl font-bold">{t('games.whatIs', { word: q.word.word })}</h3>
      <ul className="flex flex-col gap-2">
        {q.options.map((o) => {
          const right = o === q.word.definition;
          return (
            <li key={o}>
              <button
                disabled={picked !== null}
                onClick={() => {
                  setPicked(o);
                  if (right) setScore((s) => s + 1);
                }}
                className={cn(
                  'w-full rounded-theme border-2 p-3 text-left',
                  picked === null && 'border-border hover:border-accent',
                  picked !== null && right && 'border-leaf bg-bg font-semibold',
                  picked === o && !right && 'border-red-600 bg-red-600/10',
                  picked !== null && !right && picked !== o && 'border-border opacity-60',
                )}
              >
                {o}
              </button>
            </li>
          );
        })}
      </ul>
      {picked === null ? (
        <HintButton
          game="Word trivia (Gen Z slang)"
          context={`Slang word: "${q.word.word}". Possible meanings: ${q.options.map((o, k) => `${k + 1}) ${o}`).join(' ')}. Give a clue without naming the correct number.`}
          fallback={`${t('decoder.example')}: ${q.word.context_example}`}
        />
      ) : (
        <>
          <p aria-live="polite" className="font-semibold">{picked === q.word.definition ? t('games.correct') : t('games.wrong')}</p>
          <Button onClick={() => { setI(i + 1); setPicked(null); }}>{t('games.next')}</Button>
        </>
      )}
    </div>
  );
}
