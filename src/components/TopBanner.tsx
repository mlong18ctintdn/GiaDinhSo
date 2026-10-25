'use client';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import { FREE_LIMIT, isPremiumActive, usedOf } from '@/lib/types';

export default function TopBanner() {
  const { t, i18n } = useTranslation();
  const { family, setPaywall } = useApp();
  if (!family) return null;

  const premium = isPremiumActive(family);
  const expiresAt = family.premium_expires_at ? new Date(family.premium_expires_at) : null;
  const days = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)) : null;
  const left = Math.max(0, FREE_LIMIT - usedOf(family));
  const wasPremium = family.is_premium && !premium; // a plan that has ended

  let text: string;
  if (premium) {
    text = days === null ? t('banner.premiumForever') : t('banner.premium', { days, date: expiresAt!.toLocaleDateString(i18n.language) });
  } else if (wasPremium) text = t('banner.expired');
  else text = left > 0 ? t('banner.remaining', { n: left }) : t('banner.exhausted');

  const renewSoon = premium && days !== null && days <= 7;
  return (
    <div role="status" className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-accent px-3 py-2 text-center text-sm font-semibold text-accent-fg">
      <Sparkles size={16} aria-hidden />
      {premium && <span className="rounded-full bg-accent-fg px-2 py-0.5 text-xs font-extrabold tracking-wide text-accent">PRO</span>}
      <span>{text}</span>
      {(!premium || renewSoon) && (
        <button onClick={() => setPaywall(true)} className="rounded-full bg-accent-fg px-3 py-1 text-accent underline-offset-2 hover:underline">
          {premium ? t('banner.renew') : t('banner.upgrade')}
        </button>
      )}
    </div>
  );
}
