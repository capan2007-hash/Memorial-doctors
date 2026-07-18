import { Link } from 'react-router-dom'
import { useMyRequests } from './useRequests'
import { StatusPill } from '../../components/ui/StatusPill'
import { RoleGate } from '../../components/RoleGate'

export function RequestList() {
  const q = useMyRequests()
  return (
    <div>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Talepler</h2>
        <RoleGate allow={['agent','sales']}>
          <Link to="/requests/new" className="bg-slate-800 text-white rounded px-3 py-1">Yeni Talep</Link>
        </RoleGate>
      </div>
      <ul className="mt-3 space-y-2">
        {q.data?.map((r) => (
          <li key={r.id} className="border rounded p-3 bg-white flex justify-between items-center">
            <Link to={`/requests/${r.id}`} className="text-blue-600 underline">Talep #{r.id.slice(0, 8)}</Link>
            <StatusPill status={r.status} />
          </li>
        ))}
        {q.data?.length === 0 && <li className="text-slate-500">Talep yok.</li>}
      </ul>
    </div>
  )
}
