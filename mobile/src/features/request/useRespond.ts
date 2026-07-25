// Kaynak: /src/features/doctor/useRespond.ts (web) — yalnız response insert;
// talebin toplam durumu (offers_ready/escalated/in_review) server-side DB
// trigger'ı (recompute_request_status) tarafından hesaplanır, client
// request.status'a asla dokunmaz.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Decision } from '@/domain/status'

export function useRespond() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      tenantId: string
      requestId: string
      doctorId: string
      decision: Decision
      rejectReason?: string
      treatmentPlan?: string
      /** Faz M2: yanıtın girildiği dil (yazma-anında kaydedilir) — içerik çevirisi kaynak dili belirler. */
      sourceLang: string
    }) => {
      const { error } = await supabase.from('response').insert({
        tenant_id: input.tenantId,
        request_id: input.requestId,
        doctor_id: input.doctorId,
        decision: input.decision,
        reject_reason: input.rejectReason ?? null,
        treatment_plan: input.decision === 'accept' ? (input.treatmentPlan ?? null) : null,
        source_lang: input.sourceLang,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['doctor-queue'] })
      qc.invalidateQueries({ queryKey: ['request-detail', variables.requestId] })
    },
  })
}
