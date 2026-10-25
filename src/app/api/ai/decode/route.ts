import { NextResponse } from 'next/server';
import { normCode } from '@/lib/family';
import { consumeUsage, refundUsage, withUsage } from '@/lib/usage';
import { generateText, parseJson, LANG_NAME, aiErrorBody } from '@/lib/ai';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

const SYSTEM = (lang: string) =>
  `You are a warm family-communication coach for Vietnamese multi-generational families. A parent or grandparent shows you a phrase, slang or behaviour from a teen or child. Explain it without judgement and help the adult respond in a way that builds trust. Write every field in ${lang}. Reply ONLY with JSON: {"meaning": string, "psychology": string, "empathy": string, "replies": string[3], "avoid": string[2]}. "meaning" = what it means in plain words. "psychology" = what the young person may be feeling or needing. "empathy" = one short strategy for the adult. "replies" = three ready-to-say sentences. "avoid" = two reactions that usually cause conflict.`;

export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  const phrase = String(b?.phrase ?? '').trim().slice(0, 500);
  if (!code || !phrase) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const usage = await consumeUsage(code);
  if (!usage.ok) return usage.res;
  try {
    const text = await generateText({
      system: SYSTEM(LANG_NAME[b?.locale] ?? 'Vietnamese'),
      prompt: `Phrase or behaviour: """${phrase}"""`,
      json: true,
    });
    return withUsage({ result: parseJson(text) }, usage.usage);
  } catch (e) {
    await refundUsage(code);
    const err = aiErrorBody(e);
    return NextResponse.json(err.body, { status: err.status });
  }
});
