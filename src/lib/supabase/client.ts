'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Anon client. Only used for Realtime broadcast, never for table access. */
export function supabaseBrowser() {
  if (!client) {
    // These two must be referenced literally so Next can inline them at build time.
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
    client = createClient(url || 'http://localhost:54321', key || 'missing-anon-key', {
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}
