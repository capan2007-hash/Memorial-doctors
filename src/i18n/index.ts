import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import trCommon from './locales/tr/common.json'
import enCommon from './locales/en/common.json'
import arCommon from './locales/ar/common.json'
import ruCommon from './locales/ru/common.json'
import deCommon from './locales/de/common.json'
import frCommon from './locales/fr/common.json'
import trNav from './locales/tr/nav.json'
import enNav from './locales/en/nav.json'
import arNav from './locales/ar/nav.json'
import ruNav from './locales/ru/nav.json'
import deNav from './locales/de/nav.json'
import frNav from './locales/fr/nav.json'
import trAuth from './locales/tr/auth.json'
import enAuth from './locales/en/auth.json'
import arAuth from './locales/ar/auth.json'
import ruAuth from './locales/ru/auth.json'
import deAuth from './locales/de/auth.json'
import frAuth from './locales/fr/auth.json'
import trRequests from './locales/tr/requests.json'
import enRequests from './locales/en/requests.json'
import arRequests from './locales/ar/requests.json'
import ruRequests from './locales/ru/requests.json'
import deRequests from './locales/de/requests.json'
import frRequests from './locales/fr/requests.json'
import trDoctors from './locales/tr/doctors.json'
import enDoctors from './locales/en/doctors.json'
import arDoctors from './locales/ar/doctors.json'
import ruDoctors from './locales/ru/doctors.json'
import deDoctors from './locales/de/doctors.json'
import frDoctors from './locales/fr/doctors.json'
import trAdmin from './locales/tr/admin.json'
import enAdmin from './locales/en/admin.json'
import arAdmin from './locales/ar/admin.json'
import ruAdmin from './locales/ru/admin.json'
import deAdmin from './locales/de/admin.json'
import frAdmin from './locales/fr/admin.json'
import trAi from './locales/tr/ai.json'
import enAi from './locales/en/ai.json'
import arAi from './locales/ar/ai.json'
import ruAi from './locales/ru/ai.json'
import deAi from './locales/de/ai.json'
import frAi from './locales/fr/ai.json'
import trActivity from './locales/tr/activity.json'
import enActivity from './locales/en/activity.json'
import arActivity from './locales/ar/activity.json'
import ruActivity from './locales/ru/activity.json'
import deActivity from './locales/de/activity.json'
import frActivity from './locales/fr/activity.json'

export const SUPPORTED = ['tr', 'ar', 'en', 'ru', 'de', 'fr'] as const
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
      tr: { common: trCommon, nav: trNav, auth: trAuth, requests: trRequests, doctors: trDoctors, admin: trAdmin, ai: trAi, activity: trActivity },
      en: { common: enCommon, nav: enNav, auth: enAuth, requests: enRequests, doctors: enDoctors, admin: enAdmin, ai: enAi, activity: enActivity },
      ar: { common: arCommon, nav: arNav, auth: arAuth, requests: arRequests, doctors: arDoctors, admin: arAdmin, ai: arAi, activity: arActivity },
      ru: { common: ruCommon, nav: ruNav, auth: ruAuth, requests: ruRequests, doctors: ruDoctors, admin: ruAdmin, ai: ruAi, activity: ruActivity },
      de: { common: deCommon, nav: deNav, auth: deAuth, requests: deRequests, doctors: deDoctors, admin: deAdmin, ai: deAi, activity: deActivity },
      fr: { common: frCommon, nav: frNav, auth: frAuth, requests: frRequests, doctors: frDoctors, admin: frAdmin, ai: frAi, activity: frActivity },
    },
    fallbackLng: 'tr',
    supportedLngs: SUPPORTED as unknown as string[],
    defaultNS: 'common',
    ns: ['common', 'nav', 'auth', 'requests', 'doctors', 'admin', 'ai', 'activity'],
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  })

i18n.on('languageChanged', applyDir)
applyDir(i18n.language || 'tr')

export default i18n
