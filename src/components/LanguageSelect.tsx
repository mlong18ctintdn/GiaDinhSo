'use client';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/lib/store';
import { LOCALES, type Locale } from '@/lib/types';

const NAMES: Record<Locale, string> = { vi: 'Tiếng Việt', zh: '中文', en: 'English', es: 'Español' };

export default function LanguageSelect() {
  const { t } = useTranslation();
  const { locale, setLocale } = useApp();
  return (
    <label className="inline-flex items-center gap-2">
      <Globe size={18} aria-hidden />
      <span className="sr-only">{t('lang.label')}</span>
      <select className="field !w-auto !py-1.5" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
