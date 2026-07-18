import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { AiEvaluationRow, AiFeedbackRow } from '../../types/db'

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 120_000

/**
 * ai_evaluation satırını sorgular ve sonuç gelene kadar (en fazla ~2 dk) 5 sn'de
 * bir yeniden dener. RLS gereği agent rolü için boş dönebilir — bu durumda null
 * (hata değil) döner ve agent hiçbir AI çıktısı görmez.
 */
export function useAiEvaluation(requestId: string | undefined) {
  const firstMountAt = useRef(Date.now())
  return useQuery({
    queryKey: ['ai-eval', requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<AiEvaluationRow | null> => {
      const { data, error } = await supabase
        .from('ai_evaluation').select('*').eq('request_id', requestId!).maybeSingle()
      if (error) throw error
      return (data as AiEvaluationRow | null) ?? null
    },
    refetchInterval: (query) => {
      if (query.state.data) return false
      if (Date.now() - firstMountAt.current > POLL_TIMEOUT_MS) return false
      return POLL_INTERVAL_MS
    },
  })
}

/** Doktorun bu değerlendirme için kendi geri bildirim satırı (varsa). */
export function useAiFeedbackFor(evaluationId: string | undefined, doctorId: string | undefined) {
  return useQuery({
    queryKey: ['ai-fb', evaluationId, doctorId],
    enabled: !!evaluationId && !!doctorId,
    queryFn: async (): Promise<AiFeedbackRow | null> => {
      const { data, error } = await supabase
        .from('ai_feedback').select('*')
        .eq('ai_evaluation_id', evaluationId!).eq('doctor_id', doctorId!).maybeSingle()
      if (error) throw error
      return (data as AiFeedbackRow | null) ?? null
    },
  })
}
