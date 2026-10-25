import { NextResponse } from 'next/server';
import { normCode } from '@/lib/family';
import { loadGame, isGame } from '@/lib/games';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

/** Current shared state of a game, plus the server clock so every device animates in step. */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const code = normCode(p.get('code'));
  const game = p.get('game');
  if (!code || !isGame(game)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { state, version } = await loadGame(code, game);
  return NextResponse.json({ state, version, serverNow: Date.now() });
});
