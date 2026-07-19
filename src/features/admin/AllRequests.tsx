import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusPill } from '../../components/ui/StatusPill'
import { Avatar } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { timeAgo } from '../../lib/format'
import { resolveAssignees } from '../../domain/assignment'
import type { ScopedDoctor } from '../../domain/assignment'
import { slaInfo, slaLabel } from '../../domain/sla'
import type { RequestRow } from '../../types/db'
import { AiAccuracyCard } from '../ai/AiAccuracyCard'

type EnrichedRequestRow = RequestRow & { patientName: string; categoryName: string; hasAccept: boolean }

const COMPLETED_STATUSES = new Set<RequestRow['status']>(['offers_ready', 'closed'])

type SlaTab = 'all' | 'pending' | 'overdue' | 'completed'

/** Talebin gecikme panosu sınıflandırması (FR-26/29): tamamlanan durum/kabul öncelikli;
 * kalanlar SLA saatine göre geciken/bekleyen. slaInfo hasResponse=false verilir çünkü
 * bekleyen/geciken sınıflandırması "yanıt bekliyor mu" sorusuyla ilgilenir (tekil kabul
 * bir talebi zaten tamamlanmış yapar ve bu dala hiç girmez). */
function classify(
  r: EnrichedRequestRow,
  slaHours: number,
  reminderHours: number,
  now: Date,
): { tab: Exclude<SlaTab, 'all'>; info: ReturnType<typeof slaInfo> | null } {
  if (COMPLETED_STATUSES.has(r.status) || r.hasAccept) return { tab: 'completed', info: null }
  const info = slaInfo(r.assigned_at, slaHours, reminderHours, false, now)
  return { tab: info.state === 'overdue' ? 'overdue' : 'pending', info }
}

const TAB_LABEL: Record<SlaTab, string> = {
  all: 'Tümü', pending: 'Bekleyen', overdue: 'Geciken', completed: 'Tamamlanan',
}

export function AllRequests() {
  const { appUser } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<SlaTab>('all')
  const reqs = useQuery({ queryKey: ['all-requests'], queryFn: async (): Promise<EnrichedRequestRow[]> => {
    const { data } = await supabase.from('request').select('*').order('created_at', { ascending: false })
    const requests = (data ?? []) as RequestRow[]
    const [{ data: patients }, { data: categories }, { data: acceptResponses }] = await Promise.all([
      supabase.from('patient').select('id, first_name, last_name'),
      supabase.from('category').select('id, name'),
      supabase.from('response').select('request_id').eq('decision', 'accept'),
    ])
    const patientMap = new Map((patients ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]))
    const categoryMap = new Map((categories ?? []).map((c: any) => [c.id, c.name as string]))
    const acceptedRequestIds = new Set((acceptResponses ?? []).map((r: any) => r.request_id as string))
    return requests.map((r) => ({
      ...r,
      patientName: patientMap.get(r.patient_id) ?? '—',
      categoryName: categoryMap.get(r.category_id) ?? '—',
      hasAccept: acceptedRequestIds.has(r.id),
    }))
  }})
  const tenantSla = useQuery({
    queryKey: ['tenant-sla', appUser?.tenant_id],
    enabled: !!appUser?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase.from('tenant').select('sla_hours, sla_reminder_hours').single()
      if (error) throw error
      return data as { sla_hours: number; sla_reminder_hours: number }
    },
  })
  const slaHours = tenantSla.data?.sla_hours ?? 24
  const reminderHours = tenantSla.data?.sla_reminder_hours ?? 4

  const classified = useMemo(() => {
    const now = new Date()
    return (reqs.data ?? []).map((r) => ({ row: r, ...classify(r, slaHours, reminderHours, now) }))
  }, [reqs.data, slaHours, reminderHours])

  const counts = useMemo(() => ({
    all: classified.length,
    pending: classified.filter((c) => c.tab === 'pending').length,
    overdue: classified.filter((c) => c.tab === 'overdue').length,
    completed: classified.filter((c) => c.tab === 'completed').length,
  }), [classified])

  const visible = tab === 'all' ? classified : classified.filter((c) => c.tab === tab)
  const reassign = useMutation({
    // Manuel: talebin kategorisindeki (alt kırılıma göre daraltılmış) doktorları yeniden ata (audit'li)
    mutationFn: async (req: RequestRow) => {
      const { data: docs } = await supabase.from('doctor').select('id, is_active').eq('tenant_id', req.tenant_id)
      const { data: scopes } = await supabase.from('doctor_scope').select('doctor_id, category_id, subcategory_id').eq('tenant_id', req.tenant_id)
      const scoped: ScopedDoctor[] = (docs ?? []).map((d: any) => ({
        id: d.id, isActive: d.is_active,
        scopes: (scopes ?? []).filter((s: any) => s.doctor_id === d.id)
          .map((s: any) => ({ categoryId: s.category_id, subcategoryId: s.subcategory_id })),
      }))
      const targets = resolveAssignees({ categoryId: req.category_id, subcategoryId: req.subcategory_id }, scoped)
      const rows = targets.map((doctorId) => ({ tenant_id: req.tenant_id, request_id: req.id, doctor_id: doctorId, type: 'manual' as const }))
      if (rows.length) await supabase.from('assignment').upsert(rows, { onConflict: 'request_id,doctor_id', ignoreDuplicates: true })
      await supabase.from('audit_log').insert({ tenant_id: req.tenant_id, actor_id: appUser!.id, action: 'reassign', entity: 'request', after: { request_id: req.id } })
      await supabase.from('request').update({ status: 'assigned' }).eq('id', req.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-requests'] })
      toast.show('Talep yeniden atandı')
    },
    onError: () => {
      toast.show('Talep yeniden atanamadı', 'error')
    },
  })
  return (
    <div>
      <PageHeader title="Tüm Talepler" />
      <AiAccuracyCard />
      <div className="mt-3 flex flex-wrap gap-2">
        {(['all', 'pending', 'overdue', 'completed'] as SlaTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`text-sm px-3 py-1.5 rounded-full border transition ${
              tab === t
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {TAB_LABEL[t]} ({counts[t]})
          </button>
        ))}
      </div>
      {reqs.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!reqs.isLoading && reqs.data?.length === 0 && <EmptyState title="Henüz talep yok" />}
      {!reqs.isLoading && reqs.data && reqs.data.length > 0 && visible.length === 0 && (
        <EmptyState title="Bu filtrede talep yok" />
      )}
      {!reqs.isLoading && visible.length > 0 && (
        <ul className="mt-3 space-y-2">
          {visible.map(({ row: r, tab: rowTab, info }) => (
            <li key={r.id}>
              <Link
                to={`/requests/${r.id}`}
                className={`flex items-center gap-3 rounded-xl bg-surface-card shadow-card p-3 hover:bg-brand-50 transition ${
                  rowTab === 'overdue' ? 'border-l-4 border-rose-500' : ''
                }`}
              >
                <Avatar name={r.patientName} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{r.patientName}</p>
                  <p className="text-sm text-slate-500 truncate">{r.categoryName} · {timeAgo(r.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === 'submitted' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent-100 text-accent-700">Doktor atanmadı</span>
                  )}
                  {info && rowTab === 'overdue' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                      {slaLabel(info)}
                    </span>
                  )}
                  {info && rowTab === 'pending' && info.state === 'warning' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      {slaLabel(info)}
                    </span>
                  )}
                  <StatusPill status={r.status} />
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      reassign.mutate(r)
                    }}
                  >
                    Yeniden ata
                  </Button>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
