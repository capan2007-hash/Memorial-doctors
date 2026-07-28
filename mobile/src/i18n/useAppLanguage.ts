// Kaynak deseni: /src/i18n/useAppLanguage.ts (web) — app_user.language ↔ i18next köprüsü.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useSetLanguage } from '@/features/settings/useSetLanguage'
// RTL senkronu (I18nManager.forceRTL + yeniden başlatma uyarısı) burada DEĞİL — Task M1-8
// düzeltmesiyle `src/lib/rtl.ts`'te modül-seviyesinde TEK bir `i18n.on('languageChanged', …)`
// dinleyicisi olarak yaşıyor. Bu hook, kaç bileşende mount edilirse edilsin (RootNavigator +
// LanguageSwitcher gibi), yalnız kendi işini yapar; `changeLang` → `i18n.changeLanguage` →
// o tek dinleyici RTL'i senkronlar. Burada da bir abonelik açılırsa aynı olay için birden
// çok dinleyici tetiklenir ve forceRTL + Alert ÇİFT gösterilir — bkz. src/lib/rtl.ts.
import '@/lib/rtl'
import { decideServerLanguage } from './applyServerLanguage'

/**
 * - Giriş yapan kullanıcının kayıtlı dili (app_user.language) i18next'e uygulanır
 *   (auth context'teki `language` gelince / değişince).
 * - changeLang: hem i18next'i (ve dolayısıyla AsyncStorage önbelleğini) hem
 *   sunucudaki kayıtlı dili günceller (giriş yapılmışsa).
 */
// MODÜL SEVİYESİ bayrak (rtl.ts ile aynı desen): bu hook İKİ yerde mount edilir
// (_layout/RootNavigator + LanguageSwitcher). Bayrak bileşen-içi (useRef) olsaydı her
// mount kendi kopyasını tutar ve ikisi birden dili geri almaya çalışırdı — donma hatası
// tam olarak buydu (bkz. applyServerLanguage.ts başlığındaki açıklama).
let serverLanguageApplied = false

/** Yalnız testler için: modül bayrağını sıfırlar. */
export function __resetServerLanguageApplied() {
  serverLanguageApplied = false
}

export function useAppLanguage() {
  const { i18n } = useTranslation()
  const { session, language } = useAuth()
  const setLang = useSetLanguage()

  useEffect(() => {
    const decision = decideServerLanguage({
      alreadyApplied: serverLanguageApplied,
      serverLanguage: language,
      currentLanguage: i18n.language,
    })
    if (decision.markApplied) serverLanguageApplied = true
    if (decision.shouldApply && language) i18n.changeLanguage(language)
  }, [language, i18n])

  const changeLang = (lang: string) => {
    // Kullanıcı seçimi OTORİTEDİR: bayrağı hemen işaretle ki sunucudan gelen (henüz
    // güncellenmemiş) eski dil, effect üzerinden seçimi geri almasın → ping-pong yok.
    serverLanguageApplied = true
    i18n.changeLanguage(lang)
    if (session) setLang.mutate(lang)
  }

  return { lang: i18n.language, changeLang, pending: setLang.isPending }
}
