// Kaynak deseni: /src/features/settings/useSetLanguage.ts (web) — aynı whitelist'li
// SECURITY DEFINER RPC (set_my_language) mobilde de kullanılır.
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Kullanıcının arayüz dilini sunucuda günceller (set_my_language RPC; tr/ar/en/ru/de/fr whitelist). */
export function useSetLanguage() {
  return useMutation({
    mutationFn: async (lang: string) => {
      const { error } = await supabase.rpc('set_my_language', { p_lang: lang })
      if (error) throw error
    },
  })
}
