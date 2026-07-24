import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import trCommon from './locales/tr/common.json'

export const SUPPORTED = ['tr', 'ar', 'en'] as const
export type Lang = (typeof SUPPORTED)[number]
export const RTL_LANGS = new Set<string>(['ar'])

export function applyDir(lang: string) {
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { tr: { common: trCommon } },
    fallbackLng: 'tr',
    supportedLngs: SUPPORTED as unknown as string[],
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  })

i18n.on('languageChanged', applyDir)
applyDir(i18n.language || 'tr')

export default i18n
