// Kaynak: /src/features/ai/useAiFeedback.ts (web) — doktorun AI değerlendirmesine
// geri bildirim (doğru/kısmen/yanlış) yazması. useRespond.ts mobil deseniyle
// uyumlu olsun diye tenantId, useAuth() yerine mutate girdisiyle taşınır.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { AiFeedbackRow } from '@/types/db'

interface SubmitAiFeedbackInput {
  tenantId: string
  requestId: string
  aiEvaluationId: string
  doctorId: string
  label: AiFeedbackRow['label']
  note?: string
}

export function useSubmitAiFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SubmitAiFeedbackInput) => {
      const { error } = await supabase.from('ai_feedback').insert({
        tenant_id: input.tenantId,
        request_id: input.requestId,
        ai_evaluation_id: input.aiEvaluationId,
        doctor_id: input.doctorId,
        label: input.label,
        note: input.note ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['ai-fb', variables.aiEvaluationId, variables.doctorId] })
      qc.invalidateQueries({ queryKey: ['ai-eval', variables.requestId] })
    },
  })
}
