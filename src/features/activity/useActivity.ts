import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface ActivityEntry {
  request_id: string
  created_at: string
  creator_name: string
  creator_role: string
  category_name: string | null
  subcategory_name: string | null
  doctor_count: number
}

const PAGE_SIZE = 30

/**
 * Aktivite akışı: doktorlara yönlendirilen talepler (en yeni → eski). Keyset sayfalama
 * (p_before = son satırın created_at'i); 60sn'de bir sessiz yenileme ile canlı his.
 */
export function useActivityTimeline() {
  return useInfiniteQuery({
    queryKey: ['activity-timeline'],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ActivityEntry[]> => {
      const { data, error } = await supabase.rpc('activity_timeline', {
        p_limit: PAGE_SIZE,
        p_before: pageParam,
      })
      if (error) throw error
      return (data ?? []) as ActivityEntry[]
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1].created_at : undefined,
    refetchInterval: 60_000,
  })
}
