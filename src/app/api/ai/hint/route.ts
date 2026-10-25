import { NextResponse } from 'next/server';
import { normCode } from '@/lib/family';
import { consumeUsage, refundUsage, withUsage } from '@/lib/usage';
import { generateText, LANG_NAME, aiErrorBody } from '@/lib/ai';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

/** Short game hint. Costs one free operation, like every AI call. */
export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  const game = String(b?.game ?? '').slice(0, 40);
  const context = String(b?.context ?? '').slice(0, 1500);
  if (!code || !game || !context) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const usage = await consumeUsage(code);
  if (!usage.ok) return usage.res;
  try {
    const hint = await generateText({
      system: `You are a friendly family game helper. Give a hint in at most 2 short sentences in ${LANG_NAME[b?.locale] ?? 'Vietnamese'}. Be encouraging. Never reveal a trivia answer outright. If a suggested move is provided, explain why it is good.`,
      prompt: `Game: ${game}\n${context}`,
    });
    return withUsage({ hint: hint.trim() }, usage.usage);
  } catch (e) {
    await refundUsage(code);
    const err = aiErrorBody(e);
    return NextResponse.json(err.body, { status: err.status });
  }
});
