import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase/server';

/** What the browser needs to draw the "N free uses left" banner. `used` is the server's truth. */
export interface UsageInfo { used: number; limit: number; premium: boolean }
type Result = { ok: true; usage: UsageInfo } | { ok: false; res: NextResponse };

/** Spend one free operation (PRO families pass straight through). Atomic in Postgres. */
export async function consumeUsage(code: string): Promise<Result> {
  const { data, error } = await supabaseAdmin().rpc('consume_usage', { p_code: code });
  if (error || !data) {
    return { ok: false, res: NextResponse.json({ error: 'server', detail: error?.message ?? 'consume_usage failed. Run supabase/migration_v3.sql' }, { status: 500 }) };
  }
  const limit = Number(data.limit ?? 5);
  const used = Number(data.usage_count ?? 0);
  if (!data.allowed) {
    if (data.reason === 'not_found') return { ok: false, res: NextResponse.json({ error: 'not_found' }, { status: 404 }) };
    return { ok: false, res: NextResponse.json({ error: 'paywall', usage: { used: Math.max(used, limit), limit, premium: false } }, { status: 402 }) };
  }
  return { ok: true, usage: { used, limit, premium: !!data.premium } };
}

export async function refundUsage(code: string) {
  await supabaseAdmin().rpc('refund_usage', { p_code: code });
}

/** JSON response that also carries the new usage, so the banner updates from every action. */
export const withUsage = (body: Record<string, unknown>, usage: UsageInfo, init?: ResponseInit) =>
  NextResponse.json({ ...body, usage }, init);
