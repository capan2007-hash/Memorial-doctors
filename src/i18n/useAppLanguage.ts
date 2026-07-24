import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { useSetLanguage } from '../features/settings/useSetLanguage'

/**
 * app_user.language ↔ i18next köprüsü.
 * - Giriş yapan kullanıcının kayıtlı dili i18next'e uygulanır (appUser gelince / değişince).
 * - changeLang: hem i18next'i hem sunucudaki kayıtlı dili günceller (giriş yapılmışsa).
 */
export function useAppLanguage() {
  const { i18n } = useTranslation()
  const { appUser } = useAuth()
  const setLang = useSetLanguage()

  useEffect(() => {
    if (appUser?.language && appUser.language !== i18n.language) {
      i18n.changeLanguage(appUser.language)
    }
  }, [appUser?.language, i18n])

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang)
    if (appUser) setLang.mutate(lang)
  }
  return { lang: i18n.language, changeLang, pending: setLang.isPending }
}
