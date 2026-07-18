import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../components/ui/Toast'
import type { AiFeedbackRow } from '../../types/db'

interface SubmitAiFeedbackInput {
  requestId: string
  aiEvaluationId: string
  doctorId: string
  label: AiFeedbackRow['label']
  note?: string
}

/** Doktorun AI değerlendirmesine geri bildirim (doğru/kısmen/yanlış) yazması. */
export function useSubmitAiFeedback() {
  const { appUser } = useAuth()
  const { show } = useToast()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SubmitAiFeedbackInput) => {
      const { error } = await supabase.from('ai_feedback').insert({
        tenant_id: appUser!.tenant_id,
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
    onError: () => show('Geri bildirim gönderilemedi', 'error'),
  })
}
