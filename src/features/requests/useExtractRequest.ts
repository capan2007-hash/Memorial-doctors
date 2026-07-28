import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

/** `extract-request` edge fonksiyonunun normalize edilmiş çıktısı (tipli). */
export interface ExtractedRequest {
  firstName: string | null
  lastName: string | null
  phone: string | null
  birthDate: string | null
  age: number | null
  heightCm: number | null
  weightKg: number | null
  pastSurgeries: string | null
  knownConditions: string | null
  medications: string | null
  smokingStatus: 'never' | 'former' | 'current' | null
  smokingCigsPerDay: number | null
  smokingYears: number | null
  alcoholStatus: 'never' | 'occasional' | 'regular' | null
  alcoholDrinksPerWeek: number | null
  categoryId: string | null
  subcategoryId: string | null
  /** Katalog v2: hastanın istediği TÜM işlemler (sunucuda doğrulanmış id'ler, birincil başta). */
  subcategoryIds: string[]
  operationTypeId: string | null
  notes: string | null
}

/**
 * "Yapıştır ve doldur": serbest hasta metnini (herhangi bir dilde) talep alanlarına
 * çıkarır. Sonuç TASLAK'tır — satışçı kontrol eder. Yalnız onam işaretliyken çağrılır
 * (hasta verisi LLM'e gider; KVKK kapısı).
 */
export function useExtractRequest() {
  return useMutation({
    mutationFn: async ({ text, targetLang }: { text: string; targetLang: string }): Promise<ExtractedRequest> => {
      const { data, error } = await supabase.functions.invoke('extract-request', {
        body: { text, target_lang: targetLang },
      })
      if (error) throw error
      const extracted = (data as { extracted?: ExtractedRequest } | null)?.extracted
      if (!extracted) throw new Error('bos-yanit')
      return extracted
    },
  })
}
