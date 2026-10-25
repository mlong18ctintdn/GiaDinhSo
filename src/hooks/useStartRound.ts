'use client';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { post } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useApp } from '@/lib/store';

export type StartResult = { ok: true } | { ok: false; message: string };

/** Starting a solo round costs one free use. On failure the message says why (empty if the paywall opened). */
export function useStartRound(game: 'trivia' | 'oan') {
  const { t } = useTranslation();
  const code = useApp((s) => s.code);
  return useCallback(async (): Promise<StartResult> => {
    try {
      await post('/api/games/start', { code, game });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: explainError(e, t) };
    }
  }, [code, game, t]);
}
