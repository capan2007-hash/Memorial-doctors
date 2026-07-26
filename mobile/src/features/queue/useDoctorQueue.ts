// Kaynak deseni: /src/features/doctor/DoctorQueue.tsx + usePendingCount.ts (web) —
// assignment+request+patient+category join'leri aynı stratejiyle (ayrı select'ler,
// Map ile eşleme) mirror edilir; RLS tabloya özgü yetkilerle uyumludur.
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { supabase } from '@/lib/supabase'
import { catalogName } from '@/features/catalog/catalogName'
import type { RequestRow, ResponseRow } from '@/types/db'

export type DoctorQueueRow = RequestRow & {
  patientName: string
  categoryName: string
  assignedAt: string
  myResponse: ResponseRow | null
}

async function fetchDoctorQueue(doctorId: string, lang: string): Promise<DoctorQueueRow[]> {
  const { data: asgs, error: asgErr } = await supabase
    .from('assignment')
    .select('request_id, assigned_at')
    .eq('doctor_id', doctorId)
  // Hata yutulursa ağ kesintisi "Bekleyen talep yok" gibi görünür; fırlat ki
  // React Query yeniden denesin ve durum yüzeye çıksın.
  if (asgErr) throw asgErr
  const assignments = asgs ?? []
  const ids = assignments.map((a) => a.request_id as string)
  if (!ids.length) return []

  const [reqRes, patRes, catRes, respRes] = await Promise.all([
    supabase.from('request').select('*').in('id', ids).order('assigned_at', { ascending: false }),
    supabase.from('patient').select('id, first_name, last_name'),
    supabase.from('category').select('id, name, name_i18n'),
    // RLS gereği doktor yalnız kendi response'unu görür (bkz. migration 0002 resp_doctor_read).
    supabase.from('response').select('*').eq('doctor_id', doctorId).in('request_id', ids),
  ])
  const firstErr = reqRes.error ?? patRes.error ?? catRes.error ?? respRes.error
  if (firstErr) throw firstErr
  const { data } = reqRes
  const { data: patients } = patRes
  const { data: categories } = catRes
  const { data: responses } = respRes

  const requests = (data ?? []) as RequestRow[]
  const patientMap = new Map((patients ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]))
  const categoryMap = new Map((categories ?? []).map((c: any) => [c.id, c]))
  const assignedAtMap = new Map(assignments.map((a) => [a.request_id as string, a.assigned_at as string | null]))
  const responseMap = new Map((responses ?? []).map((r: any) => [r.request_id, r as ResponseRow]))

  return requests.map((r) => {
    const categoryRow = categoryMap.get(r.category_id)
    return {
      ...r,
      patientName: patientMap.get(r.patient_id) ?? '—',
      categoryName: categoryRow ? catalogName(categoryRow, lang) : '—',
      assignedAt: assignedAtMap.get(r.id) ?? r.created_at,
      myResponse: responseMap.get(r.id) ?? null,
    }
  })
}

// crypto.randomUUID Hermes/Expo SDK 57'de global olarak mevcuttur; yine de
// eski RN motorlarında bulunmama ihtimaline karşı yedek üretici tutulur.
function uniqueSuffix(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

interface TenantSla {
  sla_hours: number
  sla_reminder_hours: number
}

async function fetchTenantSla(): Promise<TenantSla> {
  // RLS tek satırla sınırlar (bkz. web AllRequests.tsx aynı desen); tenant filtresi gerekmez.
  const { data, error } = await supabase.from('tenant').select('sla_hours, sla_reminder_hours').single()
  if (error) throw error
  return data as TenantSla
}

export function useDoctorQueue(doctorId?: string | null) {
  const qc = useQueryClient()
  const { i18n } = useTranslation()
  const query = useQuery({
    queryKey: ['doctor-queue', doctorId, i18n.language],
    enabled: !!doctorId,
    queryFn: () => fetchDoctorQueue(doctorId!, i18n.language),
  })
  const tenantSla = useQuery({
    queryKey: ['tenant-sla'],
    enabled: !!doctorId,
    queryFn: fetchTenantSla,
  })
  const slaHours = tenantSla.data?.sla_hours ?? 24
  const reminderHours = tenantSla.data?.sla_reminder_hours ?? 4

  useEffect(() => {
    if (!doctorId) return
    // Kanal adı hook örneği başına benzersiz olmalı: supabase.channel() aynı
    // isimde MEVCUT kanalı döndürür; ikinci tüketici subscribe edilmiş kanala
    // .on() ekleyince exception fırlar (bkz. web usePendingCount.ts).
    const channel = supabase
      .channel(`assignment-${doctorId}-${uniqueSuffix()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'assignment', filter: `doctor_id=eq.${doctorId}` },
        () => qc.invalidateQueries({ queryKey: ['doctor-queue', doctorId] })
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [doctorId, qc])

  const pending = (query.data ?? []).filter((r) => !r.myResponse)
  const history = (query.data ?? []).filter((r) => !!r.myResponse)

  return { ...query, pending, history, slaHours, reminderHours }
}
