// Kaynak: /src/features/admin/AllRequests.tsx (web) — koordinatör gecikme panosu
// veri katmanı mobile mirror. request+patient+category+response(accept) istemci-JOIN,
// tenant SLA, ve manuel yeniden-atama (assign_request_doctors RPC).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { catalogName } from '@/features/catalog/catalogName'
import { slaInfo, type SlaInfo } from '@/domain/sla'
import type { RequestStatus } from '@/domain/status'
import type { RequestRow } from '@/types/db'

export type EnrichedRequestRow = RequestRow & {
  patientName: string
  patientPhone: string | null
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
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['all-requests', i18n.language],
    queryFn: async (): Promise<EnrichedRequestRow[]> => {
      const { data } = await supabase.from('request').select('*').order('created_at', { ascending: false })
      const requests = (data ?? []) as RequestRow[]
      const [{ data: patients }, { data: categories }, { data: acceptResponses }] = await Promise.all([
        supabase.from('patient').select('id, first_name, last_name, phone'),
        supabase.from('category').select('id, name, name_i18n'),
        supabase.from('response').select('request_id').eq('decision', 'accept'),
      ])
      const patientMap = new Map(
        (patients ?? []).map((p: { id: string; first_name: string; last_name: string; phone: string | null }) => [
          p.id,
          { name: `${p.first_name} ${p.last_name}`, phone: p.phone ?? null },
        ]),
      )
      const categoryMap = new Map(
        (categories ?? []).map((c: { id: string; name: string; name_i18n?: Record<string, string> | null }) => [c.id, c]),
      )
      const acceptedIds = new Set((acceptResponses ?? []).map((r: { request_id: string }) => r.request_id))
      return requests.map((r) => {
        const categoryRow = categoryMap.get(r.category_id)
        const pat = patientMap.get(r.patient_id)
        return {
          ...r,
          patientName: pat?.name ?? '—',
          patientPhone: pat?.phone ?? null,
          categoryName: categoryRow ? catalogName(categoryRow, i18n.language) : '—',
          hasAccept: acceptedIds.has(r.id),
        }
      })
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
  const { t } = useTranslation('admin')
  return useMutation({
    mutationFn: async (
      input: EnrichedRequestRow | { req: EnrichedRequestRow; doctorIds: string[] | null },
    ): Promise<{ assigned: boolean }> => {
      // Geriye uyumlu: doğrudan talep verilirse tüm uygun doktorlara atar.
      const req = 'req' in input ? input.req : input
      const doctorIds = 'req' in input ? input.doctorIds : null
      if (req.status === 'closed') throw new Error(t('requests.alerts.closedCannotReassign'))
      const { data: count, error } = await supabase.rpc('assign_request_doctors', {
        p_request_id: req.id,
        p_type: 'manual',
        // null → tüm uygun doktorlar; dizi → yalnız seçilenler (sunucu scope'u yine uygular).
        p_doctor_ids: doctorIds,
      })
      if (error) throw error
      return { assigned: ((count as number) ?? 0) > 0 }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-requests'] }),
  })
}
