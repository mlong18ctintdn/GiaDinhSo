'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { GenZWord } from '@/lib/types';

const cache = new Map<string, Promise<GenZWord[]>>();

/** The Gen Z dictionary in the interface language (vi, en, zh, es). */
export function useDictionary(lang: string) {
  const [words, setWords] = useState<GenZWord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    if (!cache.has(lang)) cache.set(lang, api<{ words: GenZWord[] }>(`/api/dictionary?lang=${lang}`).then((r) => r.words));
    cache
      .get(lang)!
      .then(setWords)
      .catch(() => cache.delete(lang))
      .finally(() => setLoading(false));
  }, [lang]);
  return { words, loading };
}
