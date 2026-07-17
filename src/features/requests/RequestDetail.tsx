import { useParams } from 'react-router-dom'
import { useRequestDetail } from './useRequests'
import { RoleGate } from '../../components/RoleGate'
import { StatusPill } from '../../components/StatusPill'

export function RequestDetail() {
  const { id } = useParams()
  const q = useRequestDetail(id)
  if (!q.data) return <p>Yükleniyor…</p>
  const { req, responses } = q.data
  const accepted = responses.filter((r) => r.decision === 'accept')
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Talep #{req.id.slice(0, 8)}</h2>
        <StatusPill status={req.status} />
      </div>
      {/* Doktor planları: yalnız sales/coordinator/admin. Aracıya RLS zaten engeller; UI de gizler. */}
      <RoleGate allow={['sales','coordinator','admin']}>
        <section>
          <h3 className="font-medium">Doktor Teklifleri ({accepted.length})</h3>
          {accepted.map((r) => (
            <div key={r.id} className="border rounded p-3 bg-white mt-2">
              <p className="text-sm text-slate-500">Doktor #{r.doctor_id.slice(0, 8)}</p>
              <p className="whitespace-pre-wrap">{r.treatment_plan}</p>
            </div>
          ))}
          {accepted.length === 0 && <p className="text-slate-500">Henüz kabul eden doktor yok.</p>}
        </section>
      </RoleGate>
      <RoleGate allow={['agent']}>
        <p className="text-slate-500 text-sm">Doktor yanıtı hazır olduğunda satış ekibi sizinle paylaşacaktır.</p>
      </RoleGate>
    </div>
  )
}
