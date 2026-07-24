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
 * Senkron, bağımlılıksız FNV-1a 32-bit hash. Metnin TAMAMI üzerinden çalışır
 * (yalnız bir önek değil) — React Query `queryKey`'inde tam-metin özdeşliğini
 * güvenilir biçimde temsil etmek için kullanılır. Kriptografik amaçlı değildir;
 * yalnız cache anahtarı çarpışmasını pratikte önlemek içindir.
 */
export function hashText(text: string): string {
  let hash = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    // FNV prime (16777619) ile çarpım; >>> 0 ile 32-bit unsigned'a sabitle.
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

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
    // Metnin tamamı üzerinden hesaplanan deterministik hash — "uzunluk + ilk
    // 64 karakter" imzası, sonu farklı iki metni aynı cache girdisine
    // düşürüp yanlış çeviriyi gösterebiliyordu (staleTime: Infinity ile kalıcı
    // hale gelen bir çarpışma). hashText metnin TAMAMINI kapsar.
    queryKey: ['translate', target, sourceLang, hashText(trimmed)],
    enabled: shouldTranslate,
    staleTime: Infinity,
    retry: false,
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
