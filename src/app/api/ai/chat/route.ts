import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normCode } from '@/lib/family';
import { consumeUsage, refundUsage, withUsage } from '@/lib/usage';
import { generateText, aiErrorBody, LANG_NAME, type ChatTurn } from '@/lib/ai';
import { dueNow, elderSystemPrompt, emergencyReply, isEmergency, type ClientClock } from '@/lib/ai/elder';
import { rateLimit } from '@/lib/rate-limit';
import { route } from '@/lib/route';
import type { Reminder } from '@/lib/types';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Cháu Ngoan": a gentle companion for grandparents. Reads the family's reminders and weaves them into the chat. */
export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  const locale = typeof b?.locale === 'string' && b.locale in LANG_NAME ? b.locale : 'vi';
  const turns: ChatTurn[] = (Array.isArray(b?.messages) ? b.messages : [])
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.text === 'string' && m.text.trim())
    .slice(-12)
    .map((m: any) => ({ role: m.role, text: String(m.text).trim().slice(0, 600) }));
  // Gemini wants a conversation that starts with the person and alternates roles.
  const tidy: ChatTurn[] = [];
  for (const m of turns) {
    if (!tidy.length && m.role === 'assistant') continue;
    const last = tidy[tidy.length - 1];
    if (last && last.role === m.role) last.text += `\n${m.text}`;
    else tidy.push({ ...m });
  }
  turns.splice(0, turns.length, ...tidy);
  const c = b?.clock;
  const clock: ClientClock | null =
    /^([01]\d|2[0-3]):[0-5]\d$/.test(c?.hhmm) && /^\d{4}-\d{2}-\d{2}$/.test(c?.date) && Number.isInteger(c?.weekday) ? { hhmm: c.hhmm, date: c.date, weekday: c.weekday } : null;
  if (!code || !UUID.test(String(b?.member_id)) || !clock || turns.at(-1)?.role !== 'user') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (!rateLimit(`chat:${code}`, 20, 60_000)) return NextResponse.json({ error: 'slow_down' }, { status: 429 });

  const sb = supabaseAdmin();
  const [{ data: member }, { data: rows }] = await Promise.all([
    sb.from('members').select('id,name,role,avatar').eq('id', b.member_id).eq('family_code', code).maybeSingle(),
    sb.from('reminders').select('*').eq('family_code', code),
  ]);
  if (!member) return NextResponse.json({ error: 'invalid_member' }, { status: 400 });
  const dear = locale !== 'vi' ? member.name : member.avatar === '👴' ? 'ông' : member.avatar === '👵' ? 'bà' : 'bác';

  // Health emergencies are answered at once with fixed text. Free, instant, never blocked by the paywall.
  if (isEmergency(turns.at(-1)!.text)) return NextResponse.json({ reply: emergencyReply(locale, dear), emergency: true });

  const done = new Set<string>(Array.isArray(b?.done) ? b.done.slice(0, 50).map(String) : []);
  const due = dueNow((rows ?? []) as Reminder[], member.id, clock, done);
  const weather = typeof b?.weather === 'string' ? b.weather.replace(/\s+/g, ' ').slice(0, 160) : undefined;

  const usage = await consumeUsage(code); // PRO families pass straight through: unlimited chat
  if (!usage.ok) return usage.res;
  try {
    const reply = await generateText({
      system: elderSystemPrompt({ name: member.name, dear, langName: LANG_NAME[locale], clock, weather, due }),
      history: turns,
      temperature: 0.8,
      maxOutputTokens: 700,
    });
    return withUsage({ reply: reply.trim(), due }, usage.usage);
  } catch (e) {
    await refundUsage(code);
    const err = aiErrorBody(e);
    return NextResponse.json(err.body, { status: err.status });
  }
});
