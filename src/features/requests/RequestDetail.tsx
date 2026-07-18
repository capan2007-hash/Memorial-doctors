import { useParams } from 'react-router-dom'
import { useRequestDetail } from './useRequests'
import { RoleGate } from '../../components/RoleGate'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill } from '../../components/ui/StatusPill'
import { Card } from '../../components/ui/Card'
import { PhotoGrid } from '../../components/ui/PhotoGrid'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { PatientInfoCard } from './PatientInfoCard'
import { timeAgo } from '../../lib/format'

export function RequestDetail() {
  const { id } = useParams()
  const q = useRequestDetail(id)
  if (!q.data) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }
  const { req, responses, patientName, categoryName, subcategoryName, operationName, photos, xrays } = q.data
  const accepted = responses.filter((r) => r.decision === 'accept')
  const title = `${patientName} — ${operationName ?? subcategoryName ?? categoryName}`
  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={`Talep #${req.id.slice(0, 8)} · ${timeAgo(req.created_at)}`}
        actions={<StatusPill status={req.status} />}
      />
      <PatientInfoCard
        req={req}
        patientName={patientName}
        categoryName={categoryName}
        subcategoryName={subcategoryName}
        operationName={operationName}
      />
      <Card title="Fotoğraflar">
        <PhotoGrid urls={photos} title="Fotoğraf" />
      </Card>
      {xrays.length > 0 && (
        <Card title="Diş Röntgeni">
          <PhotoGrid urls={xrays} title="Röntgen" />
        </Card>
      )}
      {/* Doktor planları: yalnız sales/coordinator/admin. Aracıya RLS zaten engeller; UI de gizler. */}
      <RoleGate allow={['sales','coordinator','admin']}>
        <section className="space-y-2">
          <h3 className="font-display text-base text-slate-900">Doktor Teklifleri ({accepted.length})</h3>
          {accepted.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start gap-3">
                <Avatar name="Doktor" size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-500">Doktor #{r.doctor_id.slice(0, 8)}</p>
                  <p className="whitespace-pre-wrap text-sm mt-1">{r.treatment_plan}</p>
                </div>
              </div>
            </Card>
          ))}
          {accepted.length === 0 && <EmptyState title="Henüz kabul eden doktor yok" />}
        </section>
      </RoleGate>
      <RoleGate allow={['agent']}>
        <Card>
          <p className="text-sm text-slate-500">Doktor yanıtı hazır olduğunda satış ekibi sizinle paylaşacaktır.</p>
        </Card>
      </RoleGate>
    </div>
  )
}
