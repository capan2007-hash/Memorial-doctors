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
      tr: { common: trCommon },
    },
    fallbackLng: 'tr',
    supportedLngs: SUPPORTED as unknown as string[],
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
  })

export default i18n
