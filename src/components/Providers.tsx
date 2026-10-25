'use client';
import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import i18n from '@/i18n';
import { useApp } from '@/lib/store';
import { themeFor } from '@/lib/themes';
import { supabaseBrowser } from '@/lib/supabase/client';
import Toaster from './Toaster';

/** Applies language and the per-member theme to <html>. */
export default function Providers({ children }: { children: React.ReactNode }) {
  const locale = useApp((s) => s.locale);
  const me = useApp((s) => s.members.find((m) => m.id === s.memberId));
  const local = useApp((s) => (s.memberId ? s.localThemes[s.memberId] : undefined));

  useEffect(() => {
    i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const { theme, font, size } = themeFor(me, local);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.font = font;
    document.documentElement.dataset.size = size;
  }, [me, local]);

  useEffect(() => {
    supabaseBrowser(); // starts the client so an email login link is picked up on arrival
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster />
    </MotionConfig>
  );
}
