import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { doctorLabel } from '../doctor/doctorLabel'

export interface EligibleDoctor {
  id: string
  name: string
  specialty: string | null
}

/**
 * Talebin kategori/alt-kırılımına YETKİN (doctor_scope) ve AKTİF doktorlar.
 * Satışçı yönlendirmeyi bu listeden daraltabilir; sunucu (assign_request_doctors)
 * aynı scope filtresini yeniden uygular → istemci seçimi yalnız DARALTIR, yetki açmaz.
 */
export function useEligibleDoctors(categoryId?: string, subcategoryId?: string | null) {
  return useQuery({
    queryKey: ['eligible-doctors', categoryId, subcategoryId ?? null],
    enabled: !!categoryId,
    queryFn: async (): Promise<EligibleDoctor[]> => {
      // Scope eşleşmesi assign_request_doctors ile BİREBİR aynı kural:
      // alt-kırılım yoksa scope'ta da null olmalı, varsa eşit olmalı.
      let scopeQuery = supabase.from('doctor_scope').select('doctor_id').eq('category_id', categoryId!)
      scopeQuery = subcategoryId
        ? scopeQuery.eq('subcategory_id', subcategoryId)
        : scopeQuery.is('subcategory_id', null)
      const { data: scopes, error } = await scopeQuery
      if (error) throw error

      const ids = Array.from(new Set((scopes ?? []).map((s: { doctor_id: string }) => s.doctor_id)))
      if (ids.length === 0) return []

      const { data: docs } = await supabase
        .from('doctor')
        .select('id, title, specialty, app_user_id')
        .in('id', ids)
        .eq('is_active', true)
      const rows = (docs ?? []) as { id: string; title: string | null; specialty: string | null; app_user_id: string | null }[]
      if (rows.length === 0) return []

      const appUserIds = rows.map((d) => d.app_user_id).filter(Boolean) as string[]
      const { data: users } = appUserIds.length
        ? await supabase.from('app_user').select('id, full_name').in('id', appUserIds)
        : { data: [] }
      const nameByUser = new Map(
        ((users ?? []) as { id: string; full_name: string | null }[]).map((u) => [u.id, u.full_name ?? '']),
      )

      return rows
        .map((d) => {
          const full = d.app_user_id ? nameByUser.get(d.app_user_id) ?? '' : ''
          // Çift unvan hatası ("Op. Dr. Op. Dr. Plastik") için ortak kural.
          const label = doctorLabel(d.title, full)
          return { id: d.id, name: label || `#${d.id.slice(0, 8)}`, specialty: d.specialty }
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    },
  })
}
