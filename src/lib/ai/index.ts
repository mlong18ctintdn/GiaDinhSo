export type ChatTurn = { role: 'user' | 'assistant'; text: string };
export type AiInput = { system: string; prompt?: string; history?: ChatTurn[]; json?: boolean; temperature?: number; maxOutputTokens?: number };

export const LANG_NAME: Record<string, string> = {
  vi: 'Vietnamese',
  zh: 'Simplified Chinese',
  en: 'English',
  es: 'Spanish',
};

/**
 * Current Gemini models (checked against ai.google.dev/gemini-api/docs/deprecations, Oct 2026).
 * gemini-1.5-* and gemini-2.0-* are SHUT DOWN; gemini-2.5-* is restricted to existing users.
 * GEMINI_MODEL goes first, the rest are fallbacks, and ListModels is the last resort.
 */
const DEFAULT_CHAIN = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEADLINE_MS = 24_000; // Vercel functions here are limited to 30 s

let lastGood: string | null = null; // remembered per warm server instance

class GeminiError extends Error {
  constructor(public status: number, message: string, public retryable: boolean) {
    super(message);
  }
}

async function reason(r: Response): Promise<string> {
  try {
    const j = await r.json();
    return String(j?.error?.message ?? j?.error ?? 'unknown').slice(0, 200);
  } catch {
    return 'unknown';
  }
}

async function callGemini(model: string, key: string, a: AiInput, ms: number): Promise<string> {
  const contents = [
    ...(a.history ?? []).map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] })),
    ...(a.prompt ? [{ role: 'user', parts: [{ text: a.prompt }] }] : []),
  ];
  const r = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.timeout(ms),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: a.system }] },
      contents,
      generationConfig: {
        temperature: a.temperature ?? 0.7,
        maxOutputTokens: a.maxOutputTokens ?? 1500,
        ...(a.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });
  if (!r.ok) {
    const why = await reason(r);
    // Bad key / bad request body: other models will not help. Model gone, quota, overload: try the next one.
    const retryable = r.status === 404 || r.status === 429 || r.status >= 500 || /no longer available|not found|not supported|deprecated/i.test(why);
    throw new GeminiError(r.status, `gemini_${r.status}: ${why} [${model}]`, retryable);
  }
  const d = await r.json();
  const text = (d.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
  if (!text) throw new GeminiError(502, `empty_response [${model}]`, true);
  return text;
}

/** Newest flash models this key can use, e.g. when Google ships gemini-3.9-flash. */
async function discover(key: string): Promise<string[]> {
  try {
    const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return [];
    const j = await r.json();
    const v = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
    return (j.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''))
      .filter((n: string) => /^gemini-\d+(\.\d+)?-flash(-lite)?$/.test(n))
      .sort((a: string, b: string) => v(b) - v(a));
  } catch {
    return [];
  }
}

async function viaGemini(a: AiInput, key: string): Promise<string> {
  const start = Date.now();
  const left = () => Math.max(1500, DEADLINE_MS - (Date.now() - start));
  const tried = new Set<string>();
  const queue = [lastGood, process.env.GEMINI_MODEL?.trim(), ...DEFAULT_CHAIN].filter((m): m is string => !!m);
  let lastErr: Error = new Error('gemini_failed');
  let discovered = false;
  while (true) {
    const model = queue.find((m) => !tried.has(m));
    if (!model) {
      if (discovered) break;
      discovered = true;
      queue.push(...(await discover(key)));
      continue;
    }
    tried.add(model);
    if (Date.now() - start > DEADLINE_MS) break;
    try {
      const text = await callGemini(model, key, a, Math.min(12_000, left()));
      lastGood = model;
      return text;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (model === lastGood) lastGood = null;
      if (e instanceof GeminiError && !e.retryable) throw e;
      console.warn('[ai] model failed, trying next:', lastErr.message);
    }
  }
  throw lastErr;
}

async function viaOpenAI(a: AiInput, key: string): Promise<string> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      temperature: a.temperature ?? 0.7,
      max_tokens: a.maxOutputTokens ?? 1500,
      ...(a.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: a.system },
        ...(a.history ?? []).map((h) => ({ role: h.role, content: h.text })),
        ...(a.prompt ? [{ role: 'user', content: a.prompt }] : []),
      ],
    }),
  });
  if (!r.ok) throw new Error(`openai_${r.status}: ${await reason(r)}`);
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content;
  if (!text) throw new Error('empty_response');
  return text;
}

/** Gemini (auto-fallback across models) first, then OpenAI. Throws 'no_ai_key' when neither key is set. */
export async function generateText(a: AiInput): Promise<string> {
  const g = process.env.GEMINI_API_KEY?.trim();
  const o = process.env.OPENAI_API_KEY?.trim();
  if (!g && !o) throw new Error('no_ai_key');
  if (g) {
    try {
      return await viaGemini(a, g);
    } catch (e) {
      if (!o) throw e;
      console.warn('[ai] Gemini failed, falling back to OpenAI:', e instanceof Error ? e.message : e);
    }
  }
  return viaOpenAI(a, o!);
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()) as T;
}

/** Shared error -> HTTP mapping for AI routes. */
export function aiErrorBody(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const notConfigured = msg === 'no_ai_key';
  return { body: { error: notConfigured ? 'ai_not_configured' : 'ai_failed', detail: notConfigured ? undefined : msg }, status: notConfigured ? 503 : 502 };
}
