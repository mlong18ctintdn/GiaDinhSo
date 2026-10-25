import { ApiError, PaywallError } from './api';

type T = (key: string) => string;

/**
 * Readable text for a failed request. Returns '' for a paywall (the paywall dialog opens by itself).
 * A 404 means the server does not have that route: the files were not all uploaded to GitHub.
 */
export function explainError(e: unknown, t: T): string {
  if (e instanceof PaywallError) return '';
  if (e instanceof ApiError) {
    if (e.status === 404 && e.message === 'http_404') return t('games.apiMissing');
    const why = e.detail || e.message;
    return why ? `${t('common.error')} (${why})` : t('common.error');
  }
  return t('common.error');
}
