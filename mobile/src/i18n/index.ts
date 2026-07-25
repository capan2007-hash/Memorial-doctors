// Kaynak deseni: /src/i18n/index.ts (web) — RN'de dil algılama i18next-browser-languagedetector
// yerine özel (async) bir LanguageDetector modülü ile yapılır: kayıtlı tercih (AsyncStorage)
// yoksa cihaz dili (expo-localization), o da desteklenmiyorsa 'tr'.
//
// Genişletme notu: sonraki görevlerde yeni namespace/dil eklenirken yalnız bu dosyadaki
// `resources` objesine ilgili JSON import'u eklenir; `ns` dizisine namespace adı eklenir.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { LanguageDetectorAsyncModule } from 'i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Localization from 'expo-localization'

import trCommon from './locales/tr/common.json'
import trAuth from './locales/tr/auth.json'
import trQueue from './locales/tr/queue.json'
import trRequest from './locales/tr/request.json'
import trProfile from './locales/tr/profile.json'
import trAdmin from './locales/tr/admin.json'
import trAi from './locales/tr/ai.json'
import trDoctors from './locales/tr/doctors.json'

import arCommon from './locales/ar/common.json'
import arAuth from './locales/ar/auth.json'
import arQueue from './locales/ar/queue.json'
import arRequest from './locales/ar/request.json'
import arProfile from './locales/ar/profile.json'
import arAdmin from './locales/ar/admin.json'
import arAi from './locales/ar/ai.json'
import arDoctors from './locales/ar/doctors.json'

import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enQueue from './locales/en/queue.json'
import enRequest from './locales/en/request.json'
import enProfile from './locales/en/profile.json'
import enAdmin from './locales/en/admin.json'
import enAi from './locales/en/ai.json'
import enDoctors from './locales/en/doctors.json'

import ruCommon from './locales/ru/common.json'
import ruAuth from './locales/ru/auth.json'
import ruQueue from './locales/ru/queue.json'
import ruRequest from './locales/ru/request.json'
import ruProfile from './locales/ru/profile.json'
import ruAdmin from './locales/ru/admin.json'
import ruAi from './locales/ru/ai.json'
import ruDoctors from './locales/ru/doctors.json'

import deCommon from './locales/de/common.json'
import deAuth from './locales/de/auth.json'
import deQueue from './locales/de/queue.json'
import deRequest from './locales/de/request.json'
import deProfile from './locales/de/profile.json'
import deAdmin from './locales/de/admin.json'
import deAi from './locales/de/ai.json'
import deDoctors from './locales/de/doctors.json'

import frCommon from './locales/fr/common.json'
import frAuth from './locales/fr/auth.json'
import frQueue from './locales/fr/queue.json'
import frRequest from './locales/fr/request.json'
import frProfile from './locales/fr/profile.json'
import frAdmin from './locales/fr/admin.json'
import frAi from './locales/fr/ai.json'
import frDoctors from './locales/fr/doctors.json'

export const SUPPORTED = ['tr', 'ar', 'en', 'ru', 'de', 'fr'] as const
export type Lang = (typeof SUPPORTED)[number]
export const RTL_LANGS = new Set<string>(['ar'])

export const LANG_STORAGE_KEY = '@app_lang'

function isSupportedLang(lng: string | null | undefined): lng is Lang {
  return !!lng && (SUPPORTED as readonly string[]).includes(lng)
}

// Sıra: kayıtlı tercih (AsyncStorage) → cihaz dili (expo-localization) → 'tr' fallback.
const asyncLanguageDetector: LanguageDetectorAsyncModule = {
  type: 'languageDetector',
  async: true,
  init: () => {},
  detect: (callback) => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY)
        if (isSupportedLang(stored)) {
          callback(stored)
          return
        }
      } catch {
        // AsyncStorage okunamadı — cihaz diline düş.
      }
      const deviceLang = Localization.getLocales()[0]?.languageCode
      callback(isSupportedLang(deviceLang) ? deviceLang : 'tr')
    })()
  },
  cacheUserLanguage: (lng) => {
    AsyncStorage.setItem(LANG_STORAGE_KEY, lng).catch(() => {
      // Kalıcılık başarısız olsa da uygulama akışını bozma.
    })
  },
}

void i18n
  .use(asyncLanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: {
        common: trCommon,
        auth: trAuth,
        queue: trQueue,
        request: trRequest,
        profile: trProfile,
        admin: trAdmin,
        ai: trAi,
        doctors: trDoctors,
      },
      ar: {
        common: arCommon,
        auth: arAuth,
        queue: arQueue,
        request: arRequest,
        profile: arProfile,
        admin: arAdmin,
        ai: arAi,
        doctors: arDoctors,
      },
      en: {
        common: enCommon,
        auth: enAuth,
        queue: enQueue,
        request: enRequest,
        profile: enProfile,
        admin: enAdmin,
        ai: enAi,
        doctors: enDoctors,
      },
      ru: {
        common: ruCommon,
        auth: ruAuth,
        queue: ruQueue,
        request: ruRequest,
        profile: ruProfile,
        admin: ruAdmin,
        ai: ruAi,
        doctors: ruDoctors,
      },
      de: {
        common: deCommon,
        auth: deAuth,
        queue: deQueue,
        request: deRequest,
        profile: deProfile,
        admin: deAdmin,
        ai: deAi,
        doctors: deDoctors,
      },
      fr: {
        common: frCommon,
        auth: frAuth,
        queue: frQueue,
        request: frRequest,
        profile: frProfile,
        admin: frAdmin,
        ai: frAi,
        doctors: frDoctors,
      },
    },
    fallbackLng: 'tr',
    supportedLngs: SUPPORTED as unknown as string[],
    defaultNS: 'common',
    ns: ['common', 'auth', 'queue', 'request', 'profile', 'admin', 'ai', 'doctors'],
    interpolation: { escapeValue: false },
  })

export default i18n
