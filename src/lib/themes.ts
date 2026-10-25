import type { Member } from './types';
import type { LocalTheme } from './store';

/**
 * Look for a member. Everyone can pick a colour theme and a font.
 * A choice saved on this device wins over the server copy, so it never snaps back.
 * The font SIZE is not a choice: grandparents always get the extra-large size.
 */
export function themeFor(m: Member | undefined, local?: LocalTheme) {
  if (!m) return { theme: 'adult', font: 'sans', size: 'normal' };
  const pick = local?.theme ?? m.custom_theme?.theme;
  const base = m.role === 'grandparent' ? 'elder' : m.role === 'parent' ? 'adult' : 'youth-neon';
  return {
    theme: pick && pick !== 'default' ? `youth-${pick}` : base,
    font: local?.font ?? m.custom_theme?.font ?? 'sans',
    size: m.role === 'grandparent' ? 'large' : 'normal',
  };
}
export const isYouth = (m?: Member) => m?.role === 'teen' || m?.role === 'child';
