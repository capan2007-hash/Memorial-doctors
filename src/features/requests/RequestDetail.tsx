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
import { Skeleton } from '@/components/shadcn/skeleton'
import { PatientInfoCard } from './PatientInfoCard'
import { AiPanel } from '../ai/AiPanel'
import { Icon } from '../../components/ui/Icon'
import { AlertTriangle, Check, Clock } from 'lucide-react'
import { timeAgo, formatDate } from '../../lib/format'
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
    setSaleStatus.mutate({ requestId: req.id, saleStatus })
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
      <div className="space-y-3.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            req.sale_status === 'operation_done'
              ? 'border-success-border bg-success-bg text-success-text'
              : req.sale_status === 'sale_done'
                ? 'border-brand-fill/25 bg-brand-fill/10 text-brand-text'
                : 'border-line bg-surface-3 text-ink-secondary'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
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
          <p className="flex items-center gap-1.5 border-t border-line pt-3 text-sm text-ink-muted">
            <Icon of={Clock} size={14} />
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
  // Hooks koşulsuz çağrılmalı (Rules of Hooks): veri gelmeden patient_id yoksa
  // hook 'enabled' değil, undefined güvenli — erken return'lerden ÖNCE çağrılır.
  const siblingOpen = useSiblingOpenRequests(q.data?.req.patient_id, q.data?.req.id)
  if (q.isError || (!q.isLoading && !q.data)) {
    return <EmptyState title="Talep bulunamadı" description="Bu talep silinmiş veya bağlantı hatalı olabilir." />
  }
  if (!q.data) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-40" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface-2 p-4 shadow-card md:p-5">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  const { req, responses, patientName, categoryName, subcategoryName, operationName, photos, xrays, deletedPhotos, deletedXrays, oldestUploadedAt } = q.data
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
        <div className="flex items-start gap-2.5 rounded-card border border-warning-border bg-warning-bg px-3.5 py-3 text-sm text-warning-text">
          <span className="mt-px shrink-0">
            <Icon of={AlertTriangle} size={16} />
          </span>
          <p>
            <span className="font-semibold">Bu hastanın başka açık talebi var</span> ({siblingCount}) — mükerrer
            kayıt olabilir.
          </p>
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
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg border border-warning-border text-warning-text text-xs font-medium px-2 py-0.5 mb-2">
            <Icon of={AlertTriangle} size={13} />
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
        {req.consent_at ? (
          <div className="flex items-start gap-2.5 rounded-card border border-success-border bg-success-bg px-3.5 py-3 text-sm text-success-text">
            <span className="mt-px shrink-0">
              <Icon of={Check} size={16} />
            </span>
            <p>
              <span className="font-semibold">Onam alındı</span> ·{' '}
              <span className="tnum">{formatDate(req.consent_at)}</span> · WhatsApp
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-card border border-warning-border bg-warning-bg px-3.5 py-3 text-sm text-warning-text">
            <span className="mt-px shrink-0">
              <Icon of={AlertTriangle} size={16} />
            </span>
            <p>
              <span className="font-semibold">Onam alınmadı</span> — yapay zekâ ön değerlendirmesi yapılmadı
            </p>
          </div>
        )}
        <SaleStatusCard req={req} oldestUploadedAt={oldestUploadedAt} />
        <AiPanel requestId={req.id} />
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 border-b border-line pb-2 font-display text-base text-ink-primary">
            Doktor Teklifleri
            <span className="tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-fill/12 px-1.5 text-xs font-semibold text-brand-text">
              {accepted.length}
            </span>
          </h3>
          {accepted.map((r) => (
            <Card key={r.id} hover>
              <div className="flex items-start gap-3">
                <Avatar name="Doktor" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-secondary">
                    Doktor <span className="font-mono text-ink-muted">#{r.doctor_id.slice(0, 8)}</span>
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-primary">{r.treatment_plan}</p>
                </div>
              </div>
            </Card>
          ))}
          {accepted.length === 0 && <EmptyState title="Henüz kabul eden doktor yok" />}
        </section>
      </RoleGate>
      <RoleGate allow={['agent']}>
        <Card>
          <p className="text-sm text-ink-secondary">Doktor yanıtı hazır olduğunda satış ekibi sizinle paylaşacaktır.</p>
        </Card>
      </RoleGate>
    </div>
  )
}
