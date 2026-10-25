/** Wheel of Chores. The server picks the winner; every client animates the same spin from the same start time. */
export const SPIN_MS = 5000;

export interface WheelMember { id: string; name: string; avatar: string | null }
export interface Spin {
  id: string;
  startedAt: number;
  duration: number;
  rotation: number; // total degrees, clockwise
  winnerIndex: number;
  members: WheelMember[];
  chore: string;
  by: string;
}
export interface HistoryItem { id: string; name: string; avatar: string | null; chore: string; at: number }
export interface WheelState { spin: Spin | null; history: HistoryItem[] }
export const IDLE_WHEEL: WheelState = { spin: null, history: [] };

/** Degrees to rotate so that sector `index` ends up under the pointer at the top. */
export function rotationFor(index: number, n: number, turns = 5): number {
  const center = ((index + 0.5) * 360) / n;
  return turns * 360 + (360 - center);
}

export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

export function angleAt(spin: Spin, now: number): number {
  const p = Math.min(1, Math.max(0, (now - spin.startedAt) / spin.duration));
  return spin.rotation * easeOut(p);
}

export const isSpinning = (s: WheelState, now: number) => !!s.spin && now < s.spin.startedAt + s.spin.duration + 500;

export function makeSpin(s: WheelState, members: WheelMember[], by: string, chore: string, now: number, rand: (n: number) => number, id: string): WheelState {
  const winnerIndex = rand(members.length);
  const w = members[winnerIndex];
  return {
    spin: { id, startedAt: now, duration: SPIN_MS, rotation: rotationFor(winnerIndex, members.length), winnerIndex, members, chore, by },
    history: [{ id, name: w.name, avatar: w.avatar, chore, at: now }, ...s.history].slice(0, 8),
  };
}
