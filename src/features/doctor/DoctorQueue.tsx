import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePendingCount } from './usePendingCount'
import { useMyDoctorId } from './useMyDoctorId'
import { Clock } from 'lucide-react'
import { Badge } from '../../components/Badge'
import { StatusPill } from '../../components/ui/StatusPill'
import { Avatar } from '../../components/ui/Avatar'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { timeAgo } from '../../lib/format'
import { slaInfo, slaLabel } from '../../domain/sla'
import type { RequestRow } from '../../types/db'

type QueueRow = RequestRow & {
  patientName: string
  categoryName: string
  seen: boolean
  assignedAt: string
  hasResponse: boolean
}

export function DoctorQueue() {
  const { appUser } = useAuth()
  const doc = useMyDoctorId()
  const pending = usePendingCount(doc.data ?? undefined)
  const list = useQuery({ queryKey: ['doctor-queue', doc.data], enabled: !!doc.data, queryFn: async (): Promise<QueueRow[]> => {
    const { data: asgs } = await supabase.from('assignment').select('request_id, seen_at, assigned_at').eq('doctor_id', doc.data!)
    const assignments = asgs ?? []
    const ids = assignments.map((a) => a.request_id)
    if (!ids.length) return []
    const { data } = await supabase.from('request').select('*').in('id', ids).order('assigned_at', { ascending: false })
    const requests = data as RequestRow[]
    const [{ data: patients }, { data: categories }, { data: responses }] = await Promise.all([
      supabase.from('patient').select('id, first_name, last_name'),
      supabase.from('category').select('id, name'),
      // RLS gereği doktor yalnız kendi response'unu görür (bkz. migration 0002 resp_doctor_read).
      supabase.from('response').select('request_id').eq('doctor_id', doc.data!).in('request_id', ids),
    ])
    const patientMap = new Map((patients ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]))
    const categoryMap = new Map((categories ?? []).map((c: any) => [c.id, c.name as string]))
    const seenMap = new Map(assignments.map((a) => [a.request_id, a.seen_at as string | null]))
    const assignedAtMap = new Map(assignments.map((a) => [a.request_id, a.assigned_at as string | null]))
    const respondedIds = new Set((responses ?? []).map((r: any) => r.request_id as string))
    return requests.map((r) => ({
      ...r,
      patientName: patientMap.get(r.patient_id) ?? '—',
      categoryName: categoryMap.get(r.category_id) ?? '—',
      seen: seenMap.get(r.id) != null,
      assignedAt: assignedAtMap.get(r.id) ?? r.created_at,
      hasResponse: respondedIds.has(r.id),
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
  return (
    <div>
      <PageHeader title="Bekleyen Talepler" actions={<Badge count={pending} />} />
      {list.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!list.isLoading && list.data?.length === 0 && (
        <EmptyState title="Bekleyen talep yok" />
      )}
      {!list.isLoading && list.data && list.data.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.data.map((r) => {
            const info = slaInfo(r.assignedAt, slaHours, reminderHours, r.hasResponse, new Date())
            const label = slaLabel(info)
            return (
              <li key={r.id}>
                <Link
                  to={`/doctor/request/${r.id}`}
                  className="flex items-center gap-3 rounded-card bg-surface-2 border border-line shadow-card p-3 transition ease-premium duration-[var(--dur-fast)] hover:shadow-pop hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40"
                >
                  {r.seen ? (
                    <span className="w-2 h-2 shrink-0" aria-hidden="true" />
                  ) : (
                    <span className="w-2 h-2 shrink-0 rounded-full bg-brand-fill" aria-hidden="true" />
                  )}
                  <Avatar name={r.patientName} />
                  <div className="flex-1 min-w-0">
                    <p className={`truncate text-ink-primary ${r.seen ? 'font-medium' : 'font-semibold'}`}>{r.patientName}</p>
                    <p className="text-sm truncate">
                      <span className="text-ink-secondary">{r.categoryName}</span>
                      <span className="text-ink-muted"> · </span>
                      <span className="text-ink-muted tnum">{timeAgo(r.assignedAt)}</span>
                    </p>
                  </div>
                  {label && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        info.state === 'overdue'
                          ? 'bg-danger-bg text-danger-text'
                          : 'bg-warning-bg text-warning-text'
                      }`}
                    >
                      <Icon of={Clock} size={12} />
                      <span className="tnum">{label}</span>
                    </span>
                  )}
                  <StatusPill status={r.status} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
