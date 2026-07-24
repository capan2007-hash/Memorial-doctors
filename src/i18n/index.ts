import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import trCommon from './locales/tr/common.json'
import enCommon from './locales/en/common.json'
import arCommon from './locales/ar/common.json'
import trNav from './locales/tr/nav.json'
import enNav from './locales/en/nav.json'
import arNav from './locales/ar/nav.json'
import trAuth from './locales/tr/auth.json'
import enAuth from './locales/en/auth.json'
import arAuth from './locales/ar/auth.json'
import trRequests from './locales/tr/requests.json'
import enRequests from './locales/en/requests.json'
import arRequests from './locales/ar/requests.json'
import trDoctors from './locales/tr/doctors.json'
import enDoctors from './locales/en/doctors.json'
import arDoctors from './locales/ar/doctors.json'

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
    resources: {
      tr: { common: trCommon, nav: trNav, auth: trAuth, requests: trRequests, doctors: trDoctors },
      en: { common: enCommon, nav: enNav, auth: enAuth, requests: enRequests, doctors: enDoctors },
      ar: { common: arCommon, nav: arNav, auth: arAuth, requests: arRequests, doctors: arDoctors },
    },
    fallbackLng: 'tr',
    supportedLngs: SUPPORTED as unknown as string[],
    defaultNS: 'common',
    ns: ['common', 'nav', 'auth', 'requests', 'doctors'],
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  })

i18n.on('languageChanged', applyDir)
applyDir(i18n.language || 'tr')

export default i18n
