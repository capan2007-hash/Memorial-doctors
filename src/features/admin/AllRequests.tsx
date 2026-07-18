import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusPill } from '../../components/StatusPill'
import { resolveAssignees } from '../../domain/assignment'
import type { ScopedDoctor } from '../../domain/assignment'
import type { RequestRow } from '../../types/db'

export function AllRequests() {
  const { appUser } = useAuth()
  const qc = useQueryClient()
  const reqs = useQuery({ queryKey: ['all-requests'], queryFn: async () => {
    const { data } = await supabase.from('request').select('*').order('created_at', { ascending: false })
    return data as RequestRow[]
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-requests'] }),
  })
  return (
    <div>
      <h2 className="text-lg font-semibold">Tüm Talepler</h2>
      <ul className="mt-3 space-y-2">
        {reqs.data?.map((r) => (
          <li key={r.id} className="border rounded p-3 bg-white flex justify-between items-center">
            <span>#{r.id.slice(0, 8)} <StatusPill status={r.status} />{r.status === 'submitted' && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 ml-2 inline-block">Doktor atanmadı</span>}</span>
            <button className="underline text-sm" onClick={() => reassign.mutate(r)}>Yeniden ata</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
