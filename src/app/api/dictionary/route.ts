import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { route } from '@/lib/route';
import seed from '@/data/genz.json';
import en from '@/data/genz.en.json';
import zh from '@/data/genz.zh.json';
import es from '@/data/genz.es.json';

export const dynamic = 'force-dynamic';

type Word = { word: string; definition: string; solution_for_parents: string; context_example: string };
const TRANSLATIONS: Record<string, Word[]> = { en, zh, es };

/**
 * Gen Z dictionary. Vietnamese comes from the database (or the bundled list if it is empty);
 * en, zh and es come from the bundled translations, matched by word. Missing words fall back to Vietnamese.
 */
export const GET = route(async (req: Request) => {
  const lang = new URL(req.url).searchParams.get('lang') ?? 'vi';
  const { data } = await supabaseAdmin().from('genz_dictionary').select('*').order('word', { ascending: true });
  const base: Word[] = data && data.length ? (data as Word[]) : (seed as Word[]);
  const tr = TRANSLATIONS[lang];
  if (!tr) return NextResponse.json({ words: base });
  const byWord = new Map(tr.map((w) => [w.word, w]));
  return NextResponse.json({
    words: base.map((w) => {
      const t = byWord.get(w.word);
      return t ? { ...w, definition: t.definition, solution_for_parents: t.solution_for_parents, context_example: t.context_example } : w;
    }),
  });
});
