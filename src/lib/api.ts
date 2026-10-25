'use client';
import { useApp } from './store';
import { supabaseBrowser } from './supabase/client';

export class PaywallError extends Error {
  constructor() {
    super('paywall');
  }
}

/** `message` is the short error code from the server; `detail` is a human-readable reason when there is one. */
export class ApiError extends Error {
  constructor(code: string, public detail?: string, public status?: number, public body?: any) {
    super(code);
  }
}

/** JSON fetch helper. Adds the owner's login token when signed in. A 402 opens the paywall. */
export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const { data } = await supabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
  });
  if (r.status === 402) {
    const b = await r.json().catch(() => null);
    if (b?.usage) useApp.getState().setUsage(b.usage);
    useApp.getState().setPaywall(true);
    throw new PaywallError();
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || `http_${r.status}`, j.detail, r.status, j);
  if (j && typeof j === 'object' && j.usage && typeof j.usage.used === 'number') useApp.getState().setUsage(j.usage);
  return j as T;
}

export const post = <T = any>(url: string, body: unknown) =>
  api<T>(url, { method: 'POST', body: JSON.stringify(body) });
