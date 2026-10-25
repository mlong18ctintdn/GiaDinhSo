import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { broadcast } from '@/lib/supabase/broadcast';
import { normCode } from '@/lib/family';
import { consumeUsage, refundUsage, withUsage } from '@/lib/usage';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';
const COLS = 'id,family_code,year,title,content,author_name,photo_url,audio_url,created_at';
const PAGE = 8;

/**
 * Two cheap reads instead of "download every story":
 *  GET ?code=X&summary=1                -> { years:[{year,count}], authors:{name:n} }  (draws the tree)
 *  GET ?code=X&year=2019[&cursor=ISO]   -> { stories:[...PAGE newest first], nextCursor }  (fills one drawer)
 */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const code = normCode(p.get('code'));
  if (!code) return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  const sb = supabaseAdmin();

  if (p.get('summary')) {
    const { data, error } = await sb.rpc('story_summary', { p_code: code });
    if (!error && data) return NextResponse.json(data);
    // Fallback while migration_v3.sql has not been run yet (PostgREST caps a response at 1000 rows).
    const { data: rows, error: e2 } = await sb.from('stories').select('year,author_name').eq('family_code', code).range(0, 999);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    const years = new Map<number, number>();
    const authors: Record<string, number> = {};
    (rows ?? []).forEach((r) => {
      years.set(r.year, (years.get(r.year) ?? 0) + 1);
      authors[r.author_name] = (authors[r.author_name] ?? 0) + 1;
    });
    return NextResponse.json({ years: [...years].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })), authors });
  }

  const year = Number(p.get('year'));
  if (!Number.isInteger(year)) return NextResponse.json({ error: 'invalid_year' }, { status: 400 });
  const cursor = p.get('cursor');
  let q = sb.from('stories').select(COLS).eq('family_code', code).eq('year', year).order('created_at', { ascending: false }).limit(PAGE + 1);
  if (cursor && !Number.isNaN(Date.parse(cursor))) q = q.lt('created_at', cursor);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  const more = rows.length > PAGE;
  const stories = more ? rows.slice(0, PAGE) : rows;
  return NextResponse.json({ stories, nextCursor: more ? stories[stories.length - 1].created_at : null });
});

/** Saving a story costs one free operation. */
export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  const year = Number(b?.year);
  const title = String(b?.title ?? '').trim().slice(0, 120);
  const content = String(b?.content ?? '').trim().slice(0, 4000);
  const author = String(b?.author_name ?? '').trim().slice(0, 60);
  if (!code || !title || !author || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const prefix = `${base}/storage/v1/object/public/family-media/${code}/`;
  const clean = (u: unknown) => (typeof u === 'string' && u.startsWith(prefix) ? u : null);

  const usage = await consumeUsage(code);
  if (!usage.ok) return usage.res;

  const { data, error } = await supabaseAdmin()
    .from('stories')
    .insert({ family_code: code, year, title, content, author_name: author, photo_url: clean(b?.photo_url), audio_url: clean(b?.audio_url) })
    .select(COLS)
    .single();
  if (error) {
    await refundUsage(code);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await broadcast(code, 'stories');
  return withUsage({ story: data }, usage.usage);
});
