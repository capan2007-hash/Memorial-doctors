import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { aggregateStatus } from '../../domain/decision'
import type { Decision } from '../../types/domain'

export function useRespond() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      tenantId: string; requestId: string; doctorId: string
      decision: Decision; rejectReason?: string; treatmentPlan?: string
    }) => {
      // 1) response yaz (doktor başına bir; unique)
      const { error } = await supabase.from('response').insert({
        tenant_id: input.tenantId, request_id: input.requestId, doctor_id: input.doctorId,
        decision: input.decision, reject_reason: input.rejectReason ?? null,
        treatment_plan: input.decision === 'accept' ? (input.treatmentPlan ?? null) : null,
      })
      if (error) throw error
      // 2) toplam durumu hesapla
      const { data: asgs } = await supabase.from('assignment').select('doctor_id').eq('request_id', input.requestId)
      const { data: resps } = await supabase.from('response').select('doctor_id, decision').eq('request_id', input.requestId)
      const status = aggregateStatus(
        (asgs ?? []).map((a) => a.doctor_id),
        (resps ?? []).map((r) => ({ doctorId: r.doctor_id, decision: r.decision as Decision })),
      )
      await supabase.from('request').update({ status }).eq('id', input.requestId)
      return status
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doctor-queue'] }); qc.invalidateQueries({ queryKey: ['requests'] }) },
  })
}
