import { NextResponse } from 'next/server';
import { ConfigError } from './supabase/server';

/**
 * Wrap every API handler so an unexpected exception becomes a readable JSON error
 * instead of an empty 500. The UI shows `detail`, and the full error lands in the server log.
 */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error('[api]', e);
      if (e instanceof ConfigError) return NextResponse.json({ error: 'config', detail: e.message }, { status: 500 });
      return NextResponse.json({ error: 'server', detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  };
}
