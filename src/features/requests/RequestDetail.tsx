import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRequestDetail, useTenantPhotoSettings } from './useRequests'
import { catalogName } from '../catalog/catalogName'
import { useSetSaleStatus } from './useSetSaleStatus'
import { useSiblingOpenRequests } from './useSiblingOpenRequests'
import { useMarkSeen } from './useUnseen'
import { usePriceOffers, useCreateOffer, useCompleteSale, type OfferCurrency } from './usePriceOffer'
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
import { TranslatedText } from '../i18n-content/TranslatedText'
import { Icon } from '../../components/ui/Icon'
import { AlertTriangle, Check, Clock, X } from 'lucide-react'
import { timeAgo, formatDate } from '../../lib/format'
import { photoLifecycleInfo } from '../../domain/photoLifecycle'
import type { SaleStatus } from '../../types/domain'
import type { RequestRow } from '../../types/db'

function SaleStatusCard({
  req,
  oldestUploadedAt,
  acceptedDoctors,
}: {
  req: RequestRow
  oldestUploadedAt: string | null
  /** Teklif verilebilecek doktorlar (kabul edenler) — id + görünen ad. */
  acceptedDoctors: { id: string; name: string }[]
}) {
  const { t } = useTranslation('requests')
  const { role, appUser } = useAuth()
  const tenantSettings = useTenantPhotoSettings(req.tenant_id)
  const setSaleStatus = useSetSaleStatus()
  const offers = usePriceOffers(req.id)
  const createOffer = useCreateOffer()
  const completeSale = useCompleteSale()

  // Teklif formu
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<OfferCurrency>('EUR')
  const [offerDoctorIds, setOfferDoctorIds] = useState<string[]>([])
  const [offerErr, setOfferErr] = useState<string | null>(null)
  // Satış kapatma formu
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [surgeryDate, setSurgeryDate] = useState('')

  const currentOffer = offers.data?.[0] ?? null
  const pastOffers = (offers.data ?? []).slice(1)
  const amountNum = Number(amount.replace(',', '.'))
  const canSaveOffer = Number.isFinite(amountNum) && amountNum > 0 && offerDoctorIds.length > 0

  const toggleOfferDoctor = (id: string) =>
    setOfferDoctorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const doctorLabel = (id: string) => acceptedDoctors.find((d) => d.id === id)?.name ?? `#${id.slice(0, 8)}`
  const formatMoney = (o: { amount: number; currency: string }) =>
    `${o.amount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${o.currency}`

  const submitOffer = async () => {
    setOfferErr(null)
    if (!appUser || !canSaveOffer) return
    try {
      await createOffer.mutateAsync({
        requestId: req.id,
        tenantId: req.tenant_id,
        createdBy: appUser.id,
        amount: amountNum,
        currency,
        doctorIds: offerDoctorIds,
      })
      setShowOfferForm(false)
      setAmount('')
      setOfferDoctorIds([])
    } catch (e) {
      setOfferErr((e as Error).message)
    }
  }

  const submitSale = async () => {
    if (!surgeryDate) return
    await completeSale.mutateAsync({ requestId: req.id, surgeryDate })
    setShowSaleForm(false)
  }

  const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
    not_completed: t('detail.saleStatus.notCompleted'),
    offer_sent: t('detail.saleStatus.offerSent'),
    sale_done: t('detail.saleStatus.saleDone'),
    operation_done: t('detail.saleStatus.operationDone'),
  }

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
    <Card title={t('detail.saleStatusTitle')}>
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
        {/* Güncel teklif özeti (varsa) — tutar + hangi doktorlar için + tarih */}
        {currentOffer && (
          <div className="rounded-card border border-line bg-surface-1 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('detail.offer.currentTitle')}</p>
            <p className="mt-0.5 font-display text-lg text-ink-primary tnum">{formatMoney(currentOffer)}</p>
            <p className="mt-1 text-sm text-ink-secondary">
              {currentOffer.doctorIds.map(doctorLabel).join(', ') || '—'}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{formatDate(currentOffer.created_at)}</p>
            {pastOffers.length > 0 && (
              <p className="mt-2 border-t border-line pt-2 text-xs text-ink-muted">
                {t('detail.offer.previous')}: {pastOffers.map((o) => formatMoney(o)).join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* Ameliyat tarihi (satış kapandıysa) */}
        {req.surgery_date && (
          <p className="flex items-center gap-1.5 text-sm text-ink-secondary">
            <Icon of={Clock} size={14} />
            {t('detail.surgeryDateLabel')}: <span className="font-medium text-ink-primary">{formatDate(req.surgery_date)}</span>
          </p>
        )}

        {/* TEKLİF FORMU: tutar + para birimi + doktor seçimi */}
        {isSales && showOfferForm && (
          <div className="space-y-3 rounded-card border border-line bg-surface-1 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-[8rem] text-sm">
                <span className="mb-1 block text-ink-secondary">{t('detail.offer.amountLabel')}</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="3000"
                  className="tnum w-full rounded-control border border-line bg-surface-2 px-3 py-2 text-ink-primary focus:border-brand-fill focus:outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-ink-secondary">{t('detail.offer.currencyLabel')}</span>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as OfferCurrency)}
                  className="rounded-control border border-line bg-surface-2 px-3 py-2 text-ink-primary focus:border-brand-fill focus:outline-none"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </div>

            <div>
              <p className="mb-1 text-sm text-ink-secondary">{t('detail.offer.doctorsLabel')}</p>
              {acceptedDoctors.length === 0 ? (
                <p className="text-sm text-ink-muted">{t('detail.offer.noAcceptedDoctors')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {acceptedDoctors.map((d) => {
                    const on = offerDoctorIds.includes(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleOfferDoctor(d.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                          on
                            ? 'border-brand-fill bg-brand-fill text-white'
                            : 'border-line bg-surface-2 text-ink-secondary hover:border-line-strong'
                        }`}
                      >
                        {on && <Icon of={Check} size={13} />}
                        {d.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {offerErr && <p className="text-sm text-danger-text">{offerErr}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={!canSaveOffer} loading={createOffer.isPending} onClick={submitOffer}>
                {t('detail.offer.save')}
              </Button>
              <Button variant="ghost" onClick={() => setShowOfferForm(false)}>
                {t('detail.offer.cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* SATIŞ KAPATMA FORMU: ameliyat tarihi */}
        {isSales && showSaleForm && (
          <div className="space-y-3 rounded-card border border-line bg-surface-1 p-3">
            <label className="block text-sm">
              <span className="mb-1 block text-ink-secondary">{t('detail.surgeryDateLabel')}</span>
              <input
                type="date"
                value={surgeryDate}
                onChange={(e) => setSurgeryDate(e.target.value)}
                className="rounded-control border border-line bg-surface-2 px-3 py-2 text-ink-primary focus:border-brand-fill focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={!surgeryDate} loading={completeSale.isPending} onClick={submitSale}>
                {t('detail.completeSaleConfirm')}
              </Button>
              <Button variant="ghost" onClick={() => setShowSaleForm(false)}>
                {t('detail.offer.cancel')}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Teklif ver / yeni teklif — satış kapanmadıysa */}
          {isSales && req.sale_status !== 'sale_done' && req.sale_status !== 'operation_done' && !showOfferForm && (
            <Button variant={currentOffer ? 'secondary' : 'primary'} onClick={() => setShowOfferForm(true)}>
              {currentOffer ? t('detail.offer.newOffer') : t('detail.offer.giveOffer')}
            </Button>
          )}
          {/* Satış tamamlandı — yalnız teklif verilmişse (ameliyat tarihi ister) */}
          {isSales && req.sale_status === 'offer_sent' && !showSaleForm && (
            <Button variant="primary" onClick={() => setShowSaleForm(true)}>
              {t('detail.markSaleDone')}
            </Button>
          )}
          {isSales && req.sale_status !== 'not_completed' && (
            <Button
              variant="secondary"
              loading={setSaleStatus.isPending}
              onClick={() => act('not_completed', t('detail.confirmSaleNotDone'))}
            >
              {t('detail.markSaleNotDone')}
            </Button>
          )}
          {isCoordAdmin && req.sale_status !== 'operation_done' && (
            <Button
              variant="secondary"
              disabled={req.sale_status !== 'sale_done'}
              loading={setSaleStatus.isPending}
              onClick={() => act('operation_done', t('detail.confirmOperationDone'))}
            >
              {t('detail.markOperationDone')}
            </Button>
          )}
        </div>
        {lifecycle && (
          <p className="flex items-center gap-1.5 border-t border-line pt-3 text-sm text-ink-muted">
            <Icon of={Clock} size={14} />
            {lifecycle.state === 'active_countdown' && t('detail.photosDeleteCountdown', { count: lifecycle.daysLeft })}
            {lifecycle.state === 'archived' && t('detail.photosArchived')}
            {lifecycle.state === 'operation_buffer' && t('detail.destructionCountdown', { count: lifecycle.daysLeft })}
          </p>
        )}
      </div>
    </Card>
  )
}

export function RequestDetail() {
  const { t, i18n } = useTranslation('requests')
  const { id } = useParams()
  const q = useRequestDetail(id)
  // Hooks koşulsuz çağrılmalı (Rules of Hooks): veri gelmeden patient_id yoksa
  // hook 'enabled' değil, undefined güvenli — erken return'lerden ÖNCE çağrılır.
  const siblingOpen = useSiblingOpenRequests(q.data?.req.patient_id, q.data?.req.id)
  // Detay açıldığında "görüldü" damgası → nav'daki bekleyen rozeti düşer.
  // Rol kapısı RPC içinde (doktor için no-op); burada yalnız bir kez tetiklenir.
  const markSeen = useMarkSeen()
  const seenRef = useRef<string | null>(null)
  const loadedId = q.data?.req.id
  useEffect(() => {
    if (!loadedId || seenRef.current === loadedId) return
    seenRef.current = loadedId
    markSeen.mutate(loadedId)
    // markSeen referansı her render'da değişebilir; yalnız talep kimliğine bağlı çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId])
  if (q.isError || (!q.isLoading && !q.data)) {
    return <EmptyState title={t('detail.notFoundTitle')} description={t('detail.notFoundDescription')} />
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
  const { req, responses, assignedCount, doctorNames, patientName, category, subcategory, operationType, procedures, photos, xrays, deletedPhotos, deletedXrays, oldestUploadedAt } = q.data
  const categoryName = category ? catalogName(category, i18n.language) : undefined
  const subcategoryName = subcategory ? catalogName(subcategory, i18n.language) : null
  const operationName = operationType ? catalogName(operationType, i18n.language) : null
  // Katalog v2: talepte seçili tüm işlemler (eski taleplerde boş → tekil alanlara düşülür).
  const procedureNames = procedures.map((p) => catalogName(p, i18n.language))
  const siblingCount = siblingOpen.data?.length ?? 0
  const accepted = responses.filter((r) => r.decision === 'accept')
  const rejected = responses.filter((r) => r.decision !== 'accept')
  // Kabul edenler önce (satış için öncelikli), red edenler altta — ama HEPSİ görünür.
  const orderedResponses = [...accepted, ...rejected]
  // Teklif verilebilecek doktorlar: KABUL edenler (red edene teklif mantıksız).
  const acceptedDoctors = accepted.map((r) => ({
    id: r.doctor_id,
    name: doctorNames.get(r.doctor_id) ?? `#${r.doctor_id.slice(0, 8)}`,
  }))
  // Atanan doktorlardan henüz yanıtlamayanlar (assignment RLS satış grubuna açık; 0050).
  const waitingCount = Math.max(0, assignedCount - responses.length)
  // Başlık: çoklu işlem varsa ilk iki işlem + "+N" (uzun başlık taşmasın).
  const procedureTitle =
    procedureNames.length > 2
      ? `${procedureNames.slice(0, 2).join(', ')} +${procedureNames.length - 2}`
      : procedureNames.join(', ')
  const title = `${patientName} — ${procedureTitle || operationName || subcategoryName || categoryName}`
  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={t('detail.subtitle', { id: req.id.slice(0, 8), time: timeAgo(req.created_at) })}
        actions={<StatusPill status={req.status} />}
      />
      {siblingCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-card border border-warning-border bg-warning-bg px-3.5 py-3 text-sm text-warning-text">
          <span className="mt-px shrink-0">
            <Icon of={AlertTriangle} size={16} />
          </span>
          <p>
            <span className="font-semibold">{t('detail.siblingWarningBold')}</span>{' '}
            {t('detail.siblingWarningSuffix', { count: siblingCount })}
          </p>
        </div>
      )}
      <PatientInfoCard
        req={req}
        patientName={patientName}
        categoryName={categoryName}
        subcategoryName={subcategoryName}
        operationName={operationName}
        procedureNames={procedureNames}
      />
      <Card title={t('newRequest.photosTitle')}>
        {req.photos_required && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg border border-warning-border text-warning-text text-xs font-medium px-2 py-0.5 mb-2">
            <Icon of={AlertTriangle} size={13} />
            {t('detail.photosRequiredBadge')}
          </span>
        )}
        <PhotoGrid urls={photos} title={t('detail.photoGridTitle')} deletedPhotos={deletedPhotos} />
      </Card>
      {(xrays.length > 0 || deletedXrays.length > 0) && (
        <Card title={t('newRequest.xraysTitle')}>
          <PhotoGrid urls={xrays} title={t('detail.xrayGridTitle')} deletedPhotos={deletedXrays} />
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
              <span className="font-semibold">{t('detail.consentReceived')}</span> ·{' '}
              <span className="tnum">{formatDate(req.consent_at)}</span> · WhatsApp
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-card border border-warning-border bg-warning-bg px-3.5 py-3 text-sm text-warning-text">
            <span className="mt-px shrink-0">
              <Icon of={AlertTriangle} size={16} />
            </span>
            <p>
              <span className="font-semibold">{t('detail.consentNotReceived')}</span> — {t('detail.consentNotReceivedHint')}
            </p>
          </div>
        )}
        <SaleStatusCard req={req} oldestUploadedAt={oldestUploadedAt} acceptedDoctors={acceptedDoctors} />
        <AiPanel requestId={req.id} />
        <section className="space-y-2">
          <h3 className="flex flex-wrap items-center gap-2 border-b border-line pb-2 font-display text-base text-ink-primary">
            {t('detail.doctorResponsesTitle')}
            {/* Özet: kaç doktora gitti · kaç kabul · kaç red · kaç bekliyor */}
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              {accepted.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-success-text">
                  <Icon of={Check} size={12} />
                  {t('detail.acceptedCount', { count: accepted.length })}
                </span>
              )}
              {rejected.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-danger-text">
                  <Icon of={X} size={12} />
                  {t('detail.rejectedCount', { count: rejected.length })}
                </span>
              )}
              {waitingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-ink-secondary">
                  <Icon of={Clock} size={12} />
                  {t('detail.waitingCount', { count: waitingCount })}
                </span>
              )}
            </span>
          </h3>

          {/* TÜM yanıtlar: kabul (tedavi planı) + red (gerekçe). Kabul edenler üstte. */}
          {orderedResponses.map((r) => {
            const isAccept = r.decision === 'accept'
            const doctorName = doctorNames.get(r.doctor_id)
            return (
              <Card key={r.id} hover>
                <div className="flex items-start gap-3">
                  <Avatar name={doctorName ?? t('detail.doctorLabel')} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink-primary">
                        {doctorName ?? (
                          <>
                            {t('detail.doctorLabel')}{' '}
                            <span className="font-mono text-ink-muted">#{r.doctor_id.slice(0, 8)}</span>
                          </>
                        )}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isAccept
                            ? 'bg-success-bg text-success-text'
                            : 'bg-danger-bg text-danger-text'
                        }`}
                      >
                        <Icon of={isAccept ? Check : X} size={12} />
                        {isAccept ? t('detail.decisionAccept') : t('detail.decisionReject')}
                      </span>
                    </div>
                    {/* Kabul → tedavi planı; red → red gerekçesi (ikisi de çevrilir). */}
                    <TranslatedText
                      text={isAccept ? r.treatment_plan : r.reject_reason}
                      sourceLang={r.source_lang}
                      className="mt-1.5 text-sm leading-relaxed text-ink-primary"
                    />
                  </div>
                </div>
              </Card>
            )
          })}
          {orderedResponses.length === 0 && <EmptyState title={t('detail.noDoctorResponses')} />}
        </section>
      </RoleGate>
      <RoleGate allow={['agent']}>
        <Card>
          <p className="text-sm text-ink-secondary">{t('detail.agentWaitingNote')}</p>
        </Card>
      </RoleGate>
    </div>
  )
}
