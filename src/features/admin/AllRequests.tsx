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
import type { RequestRow } from '../../types/db'

type EnrichedRequestRow = RequestRow & { patientName: string; categoryName: string }

export function AllRequests() {
  const { appUser } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const reqs = useQuery({ queryKey: ['all-requests'], queryFn: async (): Promise<EnrichedRequestRow[]> => {
    const { data } = await supabase.from('request').select('*').order('created_at', { ascending: false })
    const requests = (data ?? []) as RequestRow[]
    const [{ data: patients }, { data: categories }] = await Promise.all([
      supabase.from('patient').select('id, first_name, last_name'),
      supabase.from('category').select('id, name'),
    ])
    const patientMap = new Map((patients ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]))
    const categoryMap = new Map((categories ?? []).map((c: any) => [c.id, c.name as string]))
    return requests.map((r) => ({
      ...r,
      patientName: patientMap.get(r.patient_id) ?? '—',
      categoryName: categoryMap.get(r.category_id) ?? '—',
    }))
  }})
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
      {reqs.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!reqs.isLoading && reqs.data?.length === 0 && <EmptyState title="Henüz talep yok" />}
      {!reqs.isLoading && reqs.data && reqs.data.length > 0 && (
        <ul className="mt-3 space-y-2">
          {reqs.data.map((r) => (
            <li key={r.id}>
              <Link
                to={`/requests/${r.id}`}
                className="flex items-center gap-3 rounded-xl bg-surface-card shadow-card p-3 hover:bg-brand-50 transition"
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
