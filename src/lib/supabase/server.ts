import { createClient } from '@supabase/supabase-js';

/** Thrown when an environment variable is missing, so the API can say exactly which one. */
export class ConfigError extends Error {
  constructor(public missing: string[]) {
    super(`Missing environment variables: ${missing.join(', ')}`);
    this.name = 'ConfigError';
  }
}

/** Clean what people paste into dashboards: stray spaces/newlines, trailing slash, /rest/v1. */
export const cleanSupabaseUrl = (u: string) => u.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

/** Service-role client. Server only (API routes). */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean) as string[];
  if (missing.length) throw new ConfigError(missing);
  return createClient(cleanSupabaseUrl(url!), key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
