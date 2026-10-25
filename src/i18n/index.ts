import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './vi.json';
import zh from './zh.json';
import en from './en.json';
import es from './es.json';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { vi: { translation: vi }, zh: { translation: zh }, en: { translation: en }, es: { translation: es } },
    lng: 'vi',
    fallbackLng: 'vi',
    interpolation: { escapeValue: false },
  });
}
export default i18n;
