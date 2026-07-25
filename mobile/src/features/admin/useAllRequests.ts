// Kaynak: /src/features/admin/AllRequests.tsx (web) — koordinatör gecikme panosu
// veri katmanı mobile mirror. request+patient+category+response(accept) istemci-JOIN,
// tenant SLA, ve manuel yeniden-atama (assign_request_doctors RPC).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { slaInfo, type SlaInfo } from '@/domain/sla'
import type { RequestStatus } from '@/domain/status'
import type { RequestRow } from '@/types/db'

export type EnrichedRequestRow = RequestRow & {
  patientName: string
  categoryName: string
  hasAccept: boolean
}

export type SlaTab = 'all' | 'pending' | 'overdue' | 'completed'

const COMPLETED_STATUSES = new Set<RequestStatus>(['offers_ready', 'closed'])

/** Gecikme panosu sınıflandırması: tamamlanan (durum/kabul) öncelikli; kalanlar SLA'ya göre. */
export function classify(
  r: EnrichedRequestRow,
  slaHours: number,
  reminderHours: number,
  now: Date,
): { tab: Exclude<SlaTab, 'all'>; info: SlaInfo | null } {
  if (COMPLETED_STATUSES.has(r.status) || r.hasAccept) return { tab: 'completed', info: null }
  const info = slaInfo(r.assigned_at, slaHours, reminderHours, false, now)
  return { tab: info.state === 'overdue' ? 'overdue' : 'pending', info }
}

/** Tüm talepler (en yeni → eski), hasta/kategori/kabul ile zenginleştirilmiş. */
export function useAllRequests() {
  return useQuery({
    queryKey: ['all-requests'],
    queryFn: async (): Promise<EnrichedRequestRow[]> => {
      const { data } = await supabase.from('request').select('*').order('created_at', { ascending: false })
      const requests = (data ?? []) as RequestRow[]
      const [{ data: patients }, { data: categories }, { data: acceptResponses }] = await Promise.all([
        supabase.from('patient').select('id, first_name, last_name'),
        supabase.from('category').select('id, name'),
        supabase.from('response').select('request_id').eq('decision', 'accept'),
      ])
      const patientMap = new Map(
        (patients ?? []).map((p: { id: string; first_name: string; last_name: string }) => [
          p.id,
          `${p.first_name} ${p.last_name}`,
        ]),
      )
      const categoryMap = new Map((categories ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
      const acceptedIds = new Set((acceptResponses ?? []).map((r: { request_id: string }) => r.request_id))
      return requests.map((r) => ({
        ...r,
        patientName: patientMap.get(r.patient_id) ?? '—',
        categoryName: categoryMap.get(r.category_id) ?? '—',
        hasAccept: acceptedIds.has(r.id),
      }))
    },
  })
}

/** Tenant SLA parametreleri (varsayılan 24s / 4s hatırlatma). */
export function useTenantSla() {
  const { tenantId } = useAuth()
  return useQuery({
    queryKey: ['tenant-sla', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<{ sla_hours: number; sla_reminder_hours: number }> => {
      const { data, error } = await supabase.from('tenant').select('sla_hours, sla_reminder_hours').single()
      if (error) throw error
      return data as { sla_hours: number; sla_reminder_hours: number }
    },
  })
}

/** Manuel yeniden atama: assign_request_doctors RPC. 0 uygun doktor → assigned:false. */
export function useReassign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: EnrichedRequestRow): Promise<{ assigned: boolean }> => {
      if (req.status === 'closed') throw new Error('Kapanmış talep yeniden atanamaz')
      const { data: count, error } = await supabase.rpc('assign_request_doctors', {
        p_request_id: req.id,
        p_type: 'manual',
      })
      if (error) throw error
      return { assigned: ((count as number) ?? 0) > 0 }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-requests'] }),
  })
}
