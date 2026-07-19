import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

/** Aynı hastanın diğer açık (closed olmayan) taleplerinden bir satır. */
export interface SiblingOpenRequestRow {
  id: string
  status: string
  created_at: string
  category_id: string
}

/**
 * FR-45 karşılıklı haberdarlık: RequestDetail'de görüntülenen talebin hastasına
 * ait, kapatılmamış diğer talepleri getirir. RLS zaten görüş alanına göre kısıtlar
 * (coordinator/admin tenant genelini, sales kendi talebini görür) — bu davranış kasıtlıdır.
 */
export function useSiblingOpenRequests(patientId: string | undefined, currentRequestId: string | undefined) {
  return useQuery({
    queryKey: ['sibling-open', patientId, currentRequestId],
    enabled: !!patientId && !!currentRequestId,
    queryFn: async (): Promise<SiblingOpenRequestRow[]> => {
      const { data, error } = await supabase
        .from('request')
        .select('id, status, created_at, category_id')
        .eq('patient_id', patientId!)
        .neq('id', currentRequestId!)
        .neq('status', 'closed')
      if (error) throw error
      return (data ?? []) as SiblingOpenRequestRow[]
    },
  })
}
