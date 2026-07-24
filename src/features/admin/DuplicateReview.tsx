import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { Sparkles, ImageOff, UserPlus, ArrowRight } from 'lucide-react'
import { dupConfidenceClass, formatConfidencePct } from '../../domain/duplicate'
import { useDuplicateQueue, useResolveDuplicate, type DuplicateItem } from './useDuplicateQueue'
import { Textarea } from '@/components/shadcn/textarea'
import { Skeleton } from '@/components/shadcn/skeleton'

// AI güven eşiği DB varsayılanı (tenant.dup_confidence_threshold default 0.75).
const CONFIDENCE_THRESHOLD = 0.75

function formatDate(x: string | null): string {
  if (!x) return '—'
  const d = new Date(x)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR')
}

/** Küçük fotoğraf şeridi; en fazla 4 gösterilir, fazlası +N rozetiyle. */
function PhotoStrip({ urls }: { urls: string[] }) {
  const { t } = useTranslation('admin')
  if (!urls.length) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
        <Icon of={ImageOff} size={14} /> {t('duplicateReview.noPhotos')}
      </span>
    )
  }
  const shown = urls.slice(0, 4)
  const extra = urls.length - shown.length
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((u, i) => (
        <img
          key={i}
          src={u}
          alt=""
          loading="lazy"
          className="h-16 w-16 rounded-control border border-line object-cover"
        />
      ))}
      {extra > 0 && (
        <span className="flex h-16 w-16 items-center justify-center rounded-control border border-line bg-surface-1 text-xs font-medium text-ink-muted tnum">
          +{extra}
        </span>
      )}
    </div>
  )
}

/** İki başvurudan birinin özet + fotoğraf paneli. */
function SidePanel({ label, name, meta, urls }: {
  label: string; name: string; meta: { k: string; v: string }[]; urls: string[]
}) {
  return (
    <div className="flex-1 space-y-3 rounded-control border border-line bg-surface-1 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <div>
        <p className="font-medium text-ink-primary">{name}</p>
        <dl className="mt-1 space-y-0.5">
          {meta.map((m) => (
            <div key={m.k} className="flex gap-1.5 text-sm">
              <dt className="shrink-0 text-ink-muted">{m.k}:</dt>
              <dd className="min-w-0 truncate text-ink-secondary">{m.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <PhotoStrip urls={urls} />
    </div>
  )
}

/** AI görsel değerlendirme şeridi: onam yok → nötr; var → güven eşiğine göre tint. */
function AiVerdict({ item }: { item: DuplicateItem }) {
  const { t } = useTranslation('admin')
  if (item.aiSame == null) {
    return (
      <div className="flex items-start gap-2 rounded-control border border-line bg-surface-1 p-3">
        <Icon of={Sparkles} size={16} className="mt-0.5 text-ink-muted" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-secondary">{t('duplicateReview.aiNoVerdict')}</p>
          {item.aiReason && <p className="mt-0.5 text-xs text-ink-muted">{item.aiReason}</p>}
        </div>
      </div>
    )
  }
  const cls = dupConfidenceClass(item.aiConfidence, CONFIDENCE_THRESHOLD)
  const tint = cls === 'high'
    ? 'border-success-border bg-success-bg text-success-text'
    : 'border-warning-border bg-warning-bg text-warning-text'
  return (
    <div className={`flex items-start gap-2 rounded-control border p-3 ${tint}`}>
      <Icon of={Sparkles} size={16} className="mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {t('duplicateReview.aiSamePerson')} <span className="tnum">{formatConfidencePct(item.aiConfidence)}</span>
        </p>
        {item.aiReason && <p className="mt-0.5 text-xs opacity-90">{item.aiReason}</p>}
      </div>
    </div>
  )
}

function DuplicateCard({ item }: { item: DuplicateItem }) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const resolve = useResolveDuplicate()
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<'confirmed' | 'dismissed' | null>(null)

  const decide = async (decision: 'confirmed' | 'dismissed') => {
    setPending(decision)
    try {
      await resolve.mutateAsync({ requestId: item.requestId, decision, note: note.trim() || undefined })
      toast.show(t('duplicateReview.decisionSaved'))
    } catch (e) {
      toast.show(t('duplicateReview.decisionSaveFailed', { message: (e as Error).message }), 'error')
    } finally {
      setPending(null)
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <SidePanel
          label={t('duplicateReview.newApplicationLabel')}
          name={item.patientName}
          meta={[
            { k: t('duplicateReview.phoneLabel'), v: item.phone ?? '—' },
            { k: t('duplicateReview.categoryLabel'), v: item.categoryName },
            { k: t('duplicateReview.dateLabel'), v: formatDate(item.createdAt) },
          ]}
          urls={item.newPhotos}
        />
        <div className="flex items-center justify-center text-ink-muted md:px-1">
          <Icon of={ArrowRight} size={18} className="rotate-90 md:rotate-0" />
        </div>
        <SidePanel
          label={t('duplicateReview.parentRequestLabel')}
          name={item.parentPatientName}
          meta={[
            { k: t('duplicateReview.dateLabel'), v: formatDate(item.parentCreatedAt) },
            { k: t('duplicateReview.requestIdLabel'), v: item.parentRequestId.slice(0, 8) },
          ]}
          urls={item.parentPhotos}
        />
      </div>

      <AiVerdict item={item} />

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted">{t('duplicateReview.noteLabel')}</label>
        <Textarea
          placeholder={t('duplicateReview.notePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          type="button"
          loading={pending === 'dismissed'}
          disabled={resolve.isPending}
          onClick={() => decide('dismissed')}
        >
          <Icon of={UserPlus} size={15} />
          {t('duplicateReview.notDuplicateButton')}
        </Button>
        <Button
          variant="primary"
          type="button"
          loading={pending === 'confirmed'}
          disabled={resolve.isPending}
          onClick={() => decide('confirmed')}
        >
          {t('duplicateReview.duplicateButton')}
        </Button>
      </div>
    </Card>
  )
}

export function DuplicateReview() {
  const { t } = useTranslation('admin')
  const queue = useDuplicateQueue()

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('duplicateReview.title')}
        subtitle={t('duplicateReview.subtitle')}
      />

      {queue.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-card border border-line bg-surface-2 p-4 shadow-card md:p-5">
              <div className="flex flex-col gap-3 md:flex-row">
                <Skeleton className="h-32 flex-1 rounded-control" />
                <Skeleton className="h-32 flex-1 rounded-control" />
              </div>
              <Skeleton className="mt-4 h-16 w-full rounded-control" />
            </div>
          ))}
        </div>
      )}

      {!queue.isLoading && (!queue.data || queue.data.length === 0) && (
        <EmptyState title={t('duplicateReview.emptyTitle')} />
      )}

      {!queue.isLoading && queue.data && queue.data.length > 0 && (
        <div className="space-y-3">
          {queue.data.map((item) => (
            <DuplicateCard key={item.requestId} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
