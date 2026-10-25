/** Memory Flip Cards, turn based. Pure functions: the server runs them, tests can too. */
export const PAIRS = ['🍜', '🌸', '🐶', '🚲', '⭐', '🎵'];
export const RESOLVE_DELAY = 1200; // ms a mismatched pair stays visible
export const IDLE_SKIP = 25000; // ms before anyone may skip a player who is not moving

export interface Player { id: string; name: string; avatar: string | null }
export interface Card { emoji: string; matched: boolean; by: string | null }
export interface MemoryState {
  status: 'idle' | 'playing' | 'done';
  cards: Card[];
  flipped: number[];
  players: Player[];
  turn: number;
  scores: Record<string, number>;
  moves: number;
  resolveAt: number | null;
  lastMoveAt: number;
  winners: string[];
  startId: string | null; // idempotency key of the click that created this round
}
export type Rand = (n: number) => number; // returns an integer in [0, n)
export type MoveResult = { ok: true; state: MemoryState } | { ok: false; error: string };

export const IDLE_MEMORY: MemoryState = {
  status: 'idle', cards: [], flipped: [], players: [], turn: 0, scores: {}, moves: 0, resolveAt: null, lastMoveAt: 0, winners: [], startId: null,
};

export function shuffle<T>(arr: T[], rand: Rand): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function startMemory(players: Player[], now: number, rand: Rand, startId: string | null = null): MemoryState {
  return {
    status: 'playing',
    cards: shuffle([...PAIRS, ...PAIRS], rand).map((emoji) => ({ emoji, matched: false, by: null })),
    flipped: [],
    players,
    turn: 0,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    moves: 0,
    resolveAt: null,
    lastMoveAt: now,
    winners: [],
    startId,
  };
}

export function flipCard(s: MemoryState, memberId: string, index: number, now: number): MoveResult {
  if (s.status !== 'playing') return { ok: false, error: 'not_playing' };
  if (s.players[s.turn]?.id !== memberId) return { ok: false, error: 'not_your_turn' };
  if (s.flipped.length >= 2) return { ok: false, error: 'wait' };
  const card = s.cards[index];
  if (!card || card.matched || s.flipped.includes(index)) return { ok: false, error: 'invalid_card' };

  const next: MemoryState = { ...s, cards: s.cards.map((c) => ({ ...c })), flipped: [...s.flipped, index], scores: { ...s.scores }, lastMoveAt: now };
  if (next.flipped.length === 2) {
    next.moves += 1;
    const [a, b] = next.flipped;
    if (next.cards[a].emoji === next.cards[b].emoji) {
      next.cards[a].matched = next.cards[b].matched = true;
      next.cards[a].by = next.cards[b].by = memberId;
      next.scores[memberId] = (next.scores[memberId] ?? 0) + 1;
      next.flipped = []; // a match keeps the turn
      next.resolveAt = null;
      if (next.cards.every((c) => c.matched)) {
        next.status = 'done';
        const best = Math.max(...Object.values(next.scores));
        next.winners = Object.keys(next.scores).filter((id) => next.scores[id] === best);
      }
    } else {
      next.resolveAt = now + RESOLVE_DELAY;
    }
  }
  return { ok: true, state: next };
}

/** Hide a mismatched pair and pass the turn. Does nothing unless it is due, so every client may call it. */
export function resolveFlip(s: MemoryState, now: number): MemoryState {
  if (s.status !== 'playing' || s.flipped.length !== 2 || s.resolveAt === null || now < s.resolveAt) return s;
  return { ...s, flipped: [], resolveAt: null, turn: (s.turn + 1) % s.players.length, lastMoveAt: now };
}

/** Anyone may skip a player who has not moved for IDLE_SKIP ms, so the game never gets stuck. */
export function skipTurn(s: MemoryState, now: number): MoveResult {
  if (s.status !== 'playing') return { ok: false, error: 'not_playing' };
  if (now - s.lastMoveAt < IDLE_SKIP) return { ok: false, error: 'too_early' };
  return { ok: true, state: { ...s, flipped: [], resolveAt: null, turn: (s.turn + 1) % s.players.length, lastMoveAt: now } };
}

/**
 * The state as it really is at `now`: a mismatched pair whose time is up is already hidden and the turn
 * has already passed. Server AND screens use this, so nobody gets "not your turn" in the gap before the
 * hide-the-cards request lands (that gap was the cause of the false errors).
 */
export const settle = (s: MemoryState, now: number): MemoryState => resolveFlip(s, now);
