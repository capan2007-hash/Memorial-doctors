import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePendingCount } from './usePendingCount'
import { useMyDoctorId } from './useMyDoctorId'
import { Badge } from '../../components/Badge'
import { StatusPill } from '../../components/ui/StatusPill'
import { Avatar } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { timeAgo } from '../../lib/format'
import type { RequestRow } from '../../types/db'

type QueueRow = RequestRow & {
  patientName: string
  categoryName: string
  seen: boolean
  assignedAt: string
}

export function DoctorQueue() {
  const doc = useMyDoctorId()
  const pending = usePendingCount(doc.data ?? undefined)
  const list = useQuery({ queryKey: ['doctor-queue', doc.data], enabled: !!doc.data, queryFn: async (): Promise<QueueRow[]> => {
    const { data: asgs } = await supabase.from('assignment').select('request_id, seen_at, assigned_at').eq('doctor_id', doc.data!)
    const assignments = asgs ?? []
    const ids = assignments.map((a) => a.request_id)
    if (!ids.length) return []
    const { data } = await supabase.from('request').select('*').in('id', ids).order('assigned_at', { ascending: false })
    const requests = data as RequestRow[]
    const [{ data: patients }, { data: categories }] = await Promise.all([
      supabase.from('patient').select('id, first_name, last_name'),
      supabase.from('category').select('id, name'),
    ])
    const patientMap = new Map((patients ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]))
    const categoryMap = new Map((categories ?? []).map((c: any) => [c.id, c.name as string]))
    const seenMap = new Map(assignments.map((a) => [a.request_id, a.seen_at as string | null]))
    const assignedAtMap = new Map(assignments.map((a) => [a.request_id, a.assigned_at as string | null]))
    return requests.map((r) => ({
      ...r,
      patientName: patientMap.get(r.patient_id) ?? '—',
      categoryName: categoryMap.get(r.category_id) ?? '—',
      seen: seenMap.get(r.id) != null,
      assignedAt: assignedAtMap.get(r.id) ?? r.created_at,
    }))
  }})
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
          {list.data.map((r) => (
            <li key={r.id}>
              <Link
                to={`/doctor/request/${r.id}`}
                className="flex items-center gap-3 bg-surface-card rounded-xl shadow-card p-3 hover:bg-brand-50"
              >
                {r.seen ? <span className="w-2 h-2" /> : <span className="w-2 h-2 rounded-full bg-brand-600" />}
                <Avatar name={r.patientName} />
                <div className="flex-1 min-w-0">
                  <p className={`truncate ${r.seen ? 'font-medium' : 'font-semibold'}`}>{r.patientName}</p>
                  <p className="text-sm text-slate-500 truncate">{r.categoryName} · {timeAgo(r.assignedAt)}</p>
                </div>
                <StatusPill status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
