import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { id } from './locales/id';
import { en } from './locales/en';
import { ar } from './locales/ar';
import { zhCN } from './locales/zh-CN';
import { setApiLocale } from '../lib/api';

export const SUPPORTED_LOCALES = [
  { code: 'id', name: 'Bahasa Indonesia', nativeName: 'Bahasa Indonesia', dir: 'ltr' as const },
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' as const },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' as const },
  { code: 'zh-CN', name: 'Simplified Chinese', nativeName: '简体中文', dir: 'ltr' as const },
];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      id: { translation: id },
      en: { translation: en },
      ar: { translation: ar },
      'zh-CN': { translation: zhCN },
    },
    fallbackLng: 'id',
    supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'ebisnis.locale',
      caches: ['localStorage'],
    },
    // Kunci yang hilang hanya terlihat pada development.
    parseMissingKeyHandler: (key) => (import.meta.env.DEV ? `⟦${key}⟧` : ''),
  });

/** Menerapkan arah teks dokumen. Bahasa Arab memakai RTL. */
export function applyLocaleDirection(locale: string): void {
  const entry = SUPPORTED_LOCALES.find((l) => l.code === locale) ?? SUPPORTED_LOCALES[0];
  document.documentElement.lang = entry.code;
  document.documentElement.dir = entry.dir;
  setApiLocale(entry.code);
}

i18n.on('languageChanged', (locale) => applyLocaleDirection(locale));
applyLocaleDirection(i18n.language ?? 'id');

export default i18n;
