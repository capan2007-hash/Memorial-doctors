import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusPill } from '../../components/StatusPill'
import { resolveAssignees } from '../../domain/assignment'
import type { RequestRow, DoctorRow } from '../../types/db'

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
      const { data: docs } = await supabase.from('doctor').select('*').eq('category_id', req.category_id).eq('is_active', true)
      const targets = resolveAssignees(
        { categoryId: req.category_id, subcategoryId: req.subcategory_id },
        (docs as DoctorRow[] ?? []).map((d) => ({ id: d.id, categoryId: d.category_id, subcategoryId: d.subcategory_id, isActive: d.is_active })),
      )
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
            <span>#{r.id.slice(0, 8)} <StatusPill status={r.status} /></span>
            <button className="underline text-sm" onClick={() => reassign.mutate(r)}>Yeniden ata</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
