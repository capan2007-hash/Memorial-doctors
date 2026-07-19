import { useParams } from 'react-router-dom'
import { useRequestDetail, useTenantPhotoSettings } from './useRequests'
import { useSetSaleStatus } from './useSetSaleStatus'
import { useSiblingOpenRequests } from './useSiblingOpenRequests'
import { useAuth } from '../../lib/auth'
import { RoleGate } from '../../components/RoleGate'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill } from '../../components/ui/StatusPill'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PhotoGrid } from '../../components/ui/PhotoGrid'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { PatientInfoCard } from './PatientInfoCard'
import { AiPanel } from '../ai/AiPanel'
import { timeAgo } from '../../lib/format'
import { photoLifecycleInfo } from '../../domain/photoLifecycle'
import type { SaleStatus } from '../../types/domain'
import type { RequestRow } from '../../types/db'

const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  not_completed: 'Satış bekliyor',
  sale_done: 'Satış tamamlandı',
  operation_done: 'Ameliyat tamamlandı',
}

function SaleStatusCard({ req, oldestUploadedAt }: { req: RequestRow; oldestUploadedAt: string | null }) {
  const { role, appUser } = useAuth()
  const tenantSettings = useTenantPhotoSettings(req.tenant_id)
  const setSaleStatus = useSetSaleStatus()

  const isSales = role === 'sales' || role === 'coordinator' || role === 'admin'
  const isCoordAdmin = role === 'coordinator' || role === 'admin'

  function act(saleStatus: SaleStatus, confirmMessage: string) {
    if (!appUser) return
    if (!window.confirm(confirmMessage)) return
    setSaleStatus.mutate({ requestId: req.id, saleStatus, tenantId: appUser.tenant_id, actorId: appUser.id })
  }

  const lifecycle = tenantSettings.data
    ? photoLifecycleInfo(
        req.sale_status,
        { oldestUploadedAt, saleMarkedAt: req.sale_marked_at },
        tenantSettings.data.photo_retention_days,
        tenantSettings.data.photo_op_buffer_days
      )
    : null

  return (
    <Card title="Satış Durumu">
      <div className="space-y-3">
        <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {SALE_STATUS_LABEL[req.sale_status]}
        </span>
        <div className="flex flex-wrap gap-2">
          {isSales && req.sale_status !== 'sale_done' && req.sale_status !== 'operation_done' && (
            <Button
              variant="primary"
              loading={setSaleStatus.isPending}
              onClick={() => act('sale_done', 'Satışın tamamlandığını işaretlemek istediğinize emin misiniz? Fotoğraflar arşive taşınacak.')}
            >
              Satış yapıldı
            </Button>
          )}
          {isSales && req.sale_status !== 'not_completed' && (
            <Button
              variant="secondary"
              loading={setSaleStatus.isPending}
              onClick={() => act('not_completed', 'Satışın olmadığını işaretlemek istediğinize emin misiniz?')}
            >
              Satış olmadı
            </Button>
          )}
          {isCoordAdmin && req.sale_status !== 'operation_done' && (
            <Button
              variant="secondary"
              disabled={req.sale_status !== 'sale_done'}
              loading={setSaleStatus.isPending}
              onClick={() => act('operation_done', 'Ameliyatın yapıldığını işaretlemek istediğinize emin misiniz? Fotoğraflar tampon süre sonunda imha edilecek.')}
            >
              Ameliyat yapıldı
            </Button>
          )}
        </div>
        {lifecycle && (
          <p className="text-sm text-slate-500">
            {lifecycle.state === 'active_countdown' && `Fotoğraflar ${lifecycle.daysLeft} gün sonra silinecek`}
            {lifecycle.state === 'archived' && 'Fotoğraflar arşivlendi'}
            {lifecycle.state === 'operation_buffer' && `İmha: ${lifecycle.daysLeft} gün kaldı`}
          </p>
        )}
      </div>
    </Card>
  )
}

export function RequestDetail() {
  const { id } = useParams()
  const q = useRequestDetail(id)
  if (q.isError || (!q.isLoading && !q.data)) {
    return <EmptyState title="Talep bulunamadı" description="Bu talep silinmiş veya bağlantı hatalı olabilir." />
  }
  if (!q.data) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }
  const { req, responses, patientName, categoryName, subcategoryName, operationName, photos, xrays, deletedPhotos, deletedXrays, oldestUploadedAt } = q.data
  const siblingOpen = useSiblingOpenRequests(req.patient_id, req.id)
  const siblingCount = siblingOpen.data?.length ?? 0
  const accepted = responses.filter((r) => r.decision === 'accept')
  const title = `${patientName} — ${operationName ?? subcategoryName ?? categoryName}`
  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={`Talep #${req.id.slice(0, 8)} · ${timeAgo(req.created_at)}`}
        actions={<StatusPill status={req.status} />}
      />
      {siblingCount > 0 && (
        <div className="rounded-lg bg-accent-100 text-accent-700 text-sm px-3 py-2">
          ⚠ Bu hastanın başka açık talebi var ({siblingCount})
        </div>
      )}
      <PatientInfoCard
        req={req}
        patientName={patientName}
        categoryName={categoryName}
        subcategoryName={subcategoryName}
        operationName={operationName}
      />
      <Card title="Fotoğraflar">
        {req.photos_required && (
          <span className="inline-block rounded-full bg-accent-100 text-accent-700 text-xs font-medium px-2 py-0.5 mb-2">
            Fotoğraf yeniden gerekli
          </span>
        )}
        <PhotoGrid urls={photos} title="Fotoğraf" deletedPhotos={deletedPhotos} />
      </Card>
      {(xrays.length > 0 || deletedXrays.length > 0) && (
        <Card title="Diş Röntgeni">
          <PhotoGrid urls={xrays} title="Röntgen" deletedPhotos={deletedXrays} />
        </Card>
      )}
      {/* Doktor planları + AI değerlendirmesi: yalnız sales/coordinator/admin. Aracıya RLS zaten engeller; UI de gizler. */}
      <RoleGate allow={['sales','coordinator','admin']}>
        <SaleStatusCard req={req} oldestUploadedAt={oldestUploadedAt} />
        <AiPanel requestId={req.id} />
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
