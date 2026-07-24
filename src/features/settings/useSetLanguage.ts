import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

/**
 * Kullanıcının arayüz dilini sunucuda günceller (set_my_language RPC).
 *
 * Not: app_user, auth.tsx'te react-query değil useState ile tutuluyor —
 * dolayısıyla invalidate edilecek gerçek bir react-query queryKey yok.
 * Bunun yerine başarı sonrası auth context'in refreshAppUser'ı çağrılır,
 * bu da appUser satırını (yeni language dahil) sunucudan yeniden çeker.
 */
export function useSetLanguage() {
  const { refreshAppUser } = useAuth()
  return useMutation({
    mutationFn: async (lang: string) => {
      const { error } = await supabase.rpc('set_my_language', { p_lang: lang })
      if (error) throw error
    },
    onSuccess: () => refreshAppUser(),
  })
}
