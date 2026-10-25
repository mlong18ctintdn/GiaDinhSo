import { NextResponse } from 'next/server';
import { normCode } from '@/lib/family';
import { consumeUsage, withUsage } from '@/lib/usage';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

/** Starting a solo round (trivia, Ô ăn quan) costs one free use. Answers 402 when the free uses are gone. */
export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  if (!code || !['trivia', 'oan'].includes(b?.game)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const usage = await consumeUsage(code);
  if (!usage.ok) return usage.res;
  return withUsage({ ok: true }, usage.usage);
});
