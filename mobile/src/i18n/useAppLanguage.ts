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

/**
 * - Giriş yapan kullanıcının kayıtlı dili (app_user.language) i18next'e uygulanır
 *   (auth context'teki `language` gelince / değişince).
 * - changeLang: hem i18next'i (ve dolayısıyla AsyncStorage önbelleğini) hem
 *   sunucudaki kayıtlı dili günceller (giriş yapılmışsa).
 */
export function useAppLanguage() {
  const { i18n } = useTranslation()
  const { session, language } = useAuth()
  const setLang = useSetLanguage()

  useEffect(() => {
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language)
    }
  }, [language, i18n])

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang)
    if (session) setLang.mutate(lang)
  }

  return { lang: i18n.language, changeLang, pending: setLang.isPending }
}
