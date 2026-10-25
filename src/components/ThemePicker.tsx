'use client';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useState } from 'react';
import { useApp, useMe } from '@/lib/store';
import { isYouth } from '@/lib/themes';
import type { ThemeChoice, YouthFont } from '@/lib/types';
import { Modal, cn } from './ui';

const SWATCH: Record<ThemeChoice, string> = {
  default: '',
  neon: 'linear-gradient(135deg,#0a0a18 50%,#ff2bd6 50%)',
  pastel: 'linear-gradient(135deg,#f6f0ff 50%,#6a58d0 50%)',
  cyber: 'linear-gradient(135deg,#12071f 50%,#ffe600 50%)',
};
const DEFAULT_SWATCH = {
  grandparent: 'linear-gradient(135deg,#f6ecd6 50%,#1f5c3f 50%)',
  parent: 'linear-gradient(135deg,#ecebe7 50%,#38587a 50%)',
};
const FONTS: { id: YouthFont; css: string }[] = [
  { id: 'sans', css: 'var(--font-be)' },
  { id: 'round', css: 'var(--font-baloo)' },
  { id: 'grotesk', css: 'var(--font-grotesk)' },
];

/** Everyone picks a colour theme and a font. Applies instantly and saves in the background. */
export default function ThemePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const me = useMe();
  const { code, members, setMembers, setLocalTheme, localThemes } = useApp();
  const [failed, setFailed] = useState(false);
  if (!me) return null;
  const local = localThemes[me.id];

  const youth = isYouth(me);
  const stored = local?.theme ?? me.custom_theme?.theme ?? 'default';
  const theme: ThemeChoice = youth && stored === 'default' ? 'neon' : stored; // youth default is neon
  const font = local?.font ?? me.custom_theme?.font ?? 'sans';
  const choices: ThemeChoice[] = youth ? ['neon', 'pastel', 'cyber'] : ['default', 'neon', 'pastel', 'cyber'];

  async function choose(next: { theme: ThemeChoice; font: YouthFont }) {
    setLocalTheme(me!.id, next); // instant, and kept on this device
    setMembers(members.map((m) => (m.id === me!.id ? { ...m, custom_theme: next } : m)));
    try {
      await api('/api/members', { method: 'PATCH', body: JSON.stringify({ code, id: me!.id, custom_theme: next }) });
      setFailed(false);
    } catch {
      setFailed(true); // still applied here; other devices will not see it until saving works
    }
  }

  const swatch = (id: ThemeChoice) =>
    id === 'default' ? DEFAULT_SWATCH[me.role === 'grandparent' ? 'grandparent' : 'parent'] : SWATCH[id];

  return (
    <Modal open={open} onClose={onClose} title={t('theme.title')}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {choices.map((id) => (
            <button
              key={id}
              aria-pressed={theme === id}
              onClick={() => choose({ theme: id, font })}
              className={cn('flex flex-col items-center gap-2 rounded-theme border-2 p-3', theme === id ? 'border-accent' : 'border-border')}
            >
              <span className="h-12 w-12 rounded-full border border-border" style={{ background: swatch(id) }} />
              <span className="text-sm font-semibold">{t(`theme.${id}`)}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {FONTS.map((o) => (
            <button
              key={o.id}
              aria-pressed={font === o.id}
              onClick={() => choose({ theme, font: o.id })}
              style={{ fontFamily: `${o.css}, system-ui` }}
              className={cn('rounded-theme border-2 p-3 text-lg font-semibold', font === o.id ? 'border-accent' : 'border-border')}
            >
              Aa
              <span className="block text-xs">{t(`theme.font_${o.id}`)}</span>
            </button>
          ))}
        </div>
        {me.role === 'grandparent' && <p className="text-sm text-muted">{t('theme.largeNote')}</p>}
        {failed && <p role="alert" className="text-sm font-semibold text-red-600">{t('theme.saveFailed')}</p>}
      </div>
    </Modal>
  );
}
