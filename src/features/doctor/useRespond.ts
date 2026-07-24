import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Decision } from '../../types/domain'

export function useRespond() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      tenantId: string; requestId: string; doctorId: string
      decision: Decision; rejectReason?: string; treatmentPlan?: string
      /** Faz 3: yanıtın girildiği dil (yazma-anında kaydedilir) — içerik çevirisi kaynak dili belirler. */
      sourceLang: string
    }) => {
      // response yaz (doktor başına bir; unique). Talebin toplam durumu
      // (offers_ready / escalated / in_review) response üzerindeki DB trigger'ı
      // (recompute_request_status) tarafından server-side güncellenir — client
      // request tablosunu güncelleyemez (RLS'te doktorun UPDATE yetkisi yok).
      // Kural mantığı domain/decision.ts aggregateStatus ile aynıdır; trigger onun
      // SQL karşılığıdır (bkz. migration 0006). Domain fonksiyonu birim testlerde
      // ve olası iyimser UI için korunur.
      const { error } = await supabase.from('response').insert({
        tenant_id: input.tenantId, request_id: input.requestId, doctor_id: input.doctorId,
        decision: input.decision, reject_reason: input.rejectReason ?? null,
        treatment_plan: input.decision === 'accept' ? (input.treatmentPlan ?? null) : null,
        source_lang: input.sourceLang,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['doctor-queue'] })
      qc.invalidateQueries({ queryKey: ['requests'] })
      qc.invalidateQueries({ queryKey: ['doctor-request', variables.requestId] })
    },
  })
}
