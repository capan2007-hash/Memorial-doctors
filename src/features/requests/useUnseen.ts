import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { countUnseenResponses } from './unseen'

/**
 * Nav rozeti: satışçının bakmadığı doktor yanıtı olan talep sayısı.
 * RLS zaten kapsamı süzer (satışçı kendi/satış-grubu taleplerini + yanıtları görür),
 * bu yüzden ek filtre gerekmez. 60 sn'de bir tazelenir (nav her sayfada canlı kalır).
 */
export function useUnseenCount(enabled: boolean) {
  return useQuery({
    queryKey: ['unseen-count'],
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const [{ data: reqs }, { data: resps }] = await Promise.all([
        supabase.from('request').select('id, sales_seen_at'),
        supabase.from('response').select('request_id, responded_at'),
      ])
      return countUnseenResponses(reqs ?? [], resps ?? [])
    },
  })
}

/** Talep detayı açıldığında "görüldü" damgası (dar kapsamlı RPC). */
export function useMarkSeen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      await supabase.rpc('mark_request_seen', { p_request_id: requestId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unseen-count'] })
    },
  })
}
