import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// Faz 3 — İçerik çevirisi (Task 3). Serbest metin (hasta notu, doktor yanıtı vb.)
// için `translate` edge function'ını sarmalayan hook. Katalog adları (name_i18n)
// bu hook'a dokunmaz — onlar Faz 2'de ayrı çözülüyor.

export interface TranslatedResult {
  text: string
  isTranslated: boolean
  isLoading: boolean
}

type InvokeResult = { translated: string; cached: boolean }

/**
 * Kaynak dil ile hedef dil (`i18n.language`) aynıysa veya metin boşsa ÇAĞRI
 * YAPILMAZ — orijinal metin düz döner. Aksi halde `translate` edge function'ı
 * React Query ile çağrılır ve sonuç sonsuz `staleTime` ile önbelleklenir
 * (çeviri metni değişmez; kaynak metin değişirse zaten queryKey değişir).
 */
export function useTranslated(text: string | null | undefined, sourceLang: string): TranslatedResult {
  const { i18n } = useTranslation()
  const target = i18n.language
  const trimmed = text?.trim() ?? ''

  const shouldTranslate = !!trimmed && !!sourceLang && target !== sourceLang

  const query = useQuery({
    // Metnin tamamını queryKey'e koymak yerine kısa bir imza kullanıyoruz
    // (ilk 64 karakter + uzunluk) — devasa notlarda React Query'nin dahili
    // key serileştirmesini şişirmemek için. Çarpışma riski pratikte yok
    // (aynı imzalı iki farklı metin aynı çeviriyi paylaşsa bile edge function
    // zaten source_hash ile kendi önbelleğini ayrıca doğru tutuyor).
    queryKey: ['translate', target, sourceLang, trimmed.length, trimmed.slice(0, 64)],
    enabled: shouldTranslate,
    staleTime: Infinity,
    queryFn: async (): Promise<InvokeResult> => {
      const { data, error } = await supabase.functions.invoke('translate', {
        body: { text: trimmed, source_lang: sourceLang, target_lang: target },
      })
      if (error) throw error
      return data as InvokeResult
    },
  })

  if (!shouldTranslate) {
    return { text: text ?? '', isTranslated: false, isLoading: false }
  }

  if (query.isLoading) {
    // Yükleniyorken orijinal metni göster (boş/placeholder yerine).
    return { text: trimmed, isTranslated: false, isLoading: true }
  }

  if (query.isSuccess && query.data?.translated) {
    return { text: query.data.translated, isTranslated: true, isLoading: false }
  }

  // Hata veya beklenmeyen boş yanıt → sessiz fallback (orijinal metin).
  return { text: trimmed, isTranslated: false, isLoading: false }
}
