import { supabaseAdmin } from './supabase/server';
import { IDLE_MEMORY } from './memory-game';
import { IDLE_WHEEL } from './wheel';

export type GameName = 'memory' | 'wheel';
const DEFAULTS: Record<GameName, unknown> = { memory: IDLE_MEMORY, wheel: IDLE_WHEEL };
export const isGame = (g: unknown): g is GameName => g === 'memory' || g === 'wheel';

/** Load a family's shared game (one query in the common case), creating the row on first use. */
export async function loadGame<T>(code: string, game: GameName): Promise<{ state: T; version: number }> {
  const sb = supabaseAdmin();
  const read = () => sb.from('family_games').select('state,version').eq('family_code', code).eq('game', game).maybeSingle();
  let { data, error } = await read();
  if (error) throw new Error(error.message);
  if (!data) {
    await sb.from('family_games').upsert({ family_code: code, game, state: DEFAULTS[game] }, { onConflict: 'family_code,game', ignoreDuplicates: true });
    ({ data, error } = await read());
    if (error || !data) throw new Error(error?.message ?? 'game_not_found');
  }
  return { state: data.state as T, version: data.version as number };
}

/**
 * Compare-and-set: the UPDATE only matches while `version` is still what we read, so two players
 * writing at the same moment can never both win. Returns false when someone else saved first.
 */
export async function saveGame(code: string, game: GameName, state: unknown, expected: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('family_games')
    .update({ state, version: expected + 1, updated_at: new Date().toISOString() })
    .eq('family_code', code)
    .eq('game', game)
    .eq('version', expected)
    .select('version');
  if (error) throw new Error(error.message);
  return !!data && data.length === 1;
}
