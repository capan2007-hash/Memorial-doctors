// Kaynak deseni: /src/i18n/useAppLanguage.ts (web) — app_user.language ↔ i18next köprüsü.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useSetLanguage } from '@/features/settings/useSetLanguage'
import { syncRtlDirection } from '@/lib/rtl'

/**
 * - Giriş yapan kullanıcının kayıtlı dili (app_user.language) i18next'e uygulanır
 *   (auth context'teki `language` gelince / değişince).
 * - changeLang: hem i18next'i (ve dolayısıyla AsyncStorage önbelleğini) hem
 *   sunucudaki kayıtlı dili günceller (giriş yapılmışsa).
 * - i18next'in çözdüğü her dil (açılışta kayıtlı tercih/cihaz dili DAHİL, yalnız
 *   changeLang üzerinden değil) I18nManager.isRTL ile karşılaştırılır; uyuşmuyorsa
 *   Faz M1 Task 8 gereği bir kez forceRTL uygulanır + yeniden başlatma uyarısı
 *   gösterilir (bkz. src/lib/rtl.ts).
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

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => syncRtlDirection(lng, i18n)
    if (i18n.language) handleLanguageChanged(i18n.language)
    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [i18n])

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang)
    if (session) setLang.mutate(lang)
  }

  return { lang: i18n.language, changeLang, pending: setLang.isPending }
}
