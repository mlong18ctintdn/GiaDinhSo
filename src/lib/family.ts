import { randomInt } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Returns a clean 6-char family code or null when invalid. */
export const normCode = (c: unknown): string | null => {
  const s = String(c ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(s) ? s : null;
};
