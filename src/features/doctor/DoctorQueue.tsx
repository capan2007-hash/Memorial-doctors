import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePendingCount } from './usePendingCount'
import { Badge } from '../../components/Badge'
import { StatusPill } from '../../components/ui/StatusPill'
import type { RequestRow } from '../../types/db'

function useMyDoctorId() {
  const { appUser } = useAuth()
  return useQuery({ queryKey: ['my-doctor', appUser?.id], enabled: !!appUser, queryFn: async () => {
    const { data } = await supabase.from('doctor').select('id').eq('app_user_id', appUser!.id).single()
    return data?.id as string | undefined
  }})
}

export function DoctorQueue() {
  const doc = useMyDoctorId()
  const pending = usePendingCount(doc.data)
  const list = useQuery({ queryKey: ['doctor-queue', doc.data], enabled: !!doc.data, queryFn: async () => {
    const { data: asgs } = await supabase.from('assignment').select('request_id').eq('doctor_id', doc.data!)
    const ids = (asgs ?? []).map((a) => a.request_id)
    if (!ids.length) return []
    const { data } = await supabase.from('request').select('*').in('id', ids).order('assigned_at', { ascending: false })
    return data as RequestRow[]
  }})
  return (
    <div>
      <h2 className="text-lg font-semibold">Bekleyen Talepler <Badge count={pending} /></h2>
      <ul className="mt-3 space-y-2">
        {list.data?.map((r) => (
          <li key={r.id} className="border rounded p-3 bg-white flex justify-between items-center">
            <span>Talep #{r.id.slice(0, 8)}</span>
            <span className="flex items-center gap-2"><StatusPill status={r.status} />
              <Link className="text-blue-600 underline" to={`/doctor/request/${r.id}`}>Aç</Link></span>
          </li>
        ))}
        {list.data?.length === 0 && <li className="text-slate-500">Talep yok.</li>}
      </ul>
    </div>
  )
}
