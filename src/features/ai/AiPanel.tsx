import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ImageOff, FileWarning, Ruler, Info, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { Input } from '@/components/shadcn/input'
import { useAiEvaluation, useAiFeedbackFor } from './useAiEvaluation'
import { useSubmitAiFeedback } from './useAiFeedback'
import type { AiFeedbackRow } from '../../types/db'

const POLL_GIVE_UP_MS = 120_000

// AI tarafından üretilen uyarı TÜRLERİ sabittir (DB değil) → sabit UI metni, çevrilir.
// Anahtarlar `ai:warnings.*` altında. Metin AI GEREKÇESİ (rationale) ayrı — o çevrilmez (Faz 3).
const WARNING_LABEL_KEYS: Record<string, string> = {
  photo_operation_mismatch: 'warnings.photo_operation_mismatch',
  demographics_operation_risk: 'warnings.demographics_operation_risk',
  missing_data: 'warnings.missing_data',
  photo_quality: 'warnings.photo_quality',
}

const WARNING_ICONS: Record<string, LucideIcon> = {
  photo_operation_mismatch: ImageOff,
  demographics_operation_risk: Ruler,
  missing_data: FileWarning,
  photo_quality: AlertTriangle,
}

const FEEDBACK_OPTIONS: AiFeedbackRow['label'][] = ['correct', 'partial', 'wrong']

function FeedbackSection({
  requestId,
  aiEvaluationId,
  doctorId,
}: {
  requestId: string
  aiEvaluationId: string
  doctorId: string
}) {
  const { t } = useTranslation('ai')
  const existing = useAiFeedbackFor(aiEvaluationId, doctorId)
  const submit = useSubmitAiFeedback()
  const [selected, setSelected] = useState<AiFeedbackRow['label'] | null>(null)
  const [note, setNote] = useState('')

  if (existing.data) {
    return (
      <div className="mt-4 pt-3 border-t border-line">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-text text-xs font-medium px-3 py-1">
          <Icon of={Check} size={13} />
          {t('feedback.yourFeedback', { label: t(`feedback.${existing.data.label}`) })}
        </span>
        {existing.data.note && (
          <p className="text-sm text-ink-secondary mt-2">{existing.data.note}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 pt-3 border-t border-line space-y-2">
      <p className="text-sm text-ink-secondary">{t('feedback.prompt')}</p>
      <div className="flex gap-2 flex-wrap">
        {FEEDBACK_OPTIONS.map((label) => (
          <Button
            key={label}
            type="button"
            variant={selected === label ? 'primary' : 'secondary'}
            onClick={() => setSelected(label)}
          >
            {t(`feedback.${label}`)}
          </Button>
        ))}
      </div>
      <Input
        type="text"
        placeholder={t('feedback.notePlaceholder')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        type="button"
        variant="primary"
        disabled={!selected}
        loading={submit.isPending}
        onClick={() => {
          if (!selected) return
          submit.mutate({ requestId, aiEvaluationId, doctorId, label: selected, note: note || undefined })
        }}
      >
        {t('feedback.submit')}
      </Button>
    </div>
  )
}

export function AiPanel({
  requestId,
  canGiveFeedback = false,
  doctorId,
}: {
  requestId: string
  canGiveFeedback?: boolean
  doctorId?: string | null
}) {
  const { t } = useTranslation('ai')
  // Veri null kaldıkça React Query yeni render tetiklemez; süre kontrolü
  // ancak zamanlayıcıyla zorlanan bir render'da yeniden değerlendirilebilir.
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), POLL_GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [requestId])
  const q = useAiEvaluation(requestId)

  if (q.isLoading || (q.data == null && !gaveUp)) {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-ink-muted px-1">
        <Spinner />
        <span>{t('panel.loading')}</span>
      </div>
    )
  }

  if (!q.data) return null

  const evaluation = q.data

  if (evaluation.status === 'failed') {
    return (
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-ink-muted px-1">
        <Icon of={AlertTriangle} size={15} />
        {t('panel.failed')}
      </p>
    )
  }

  return (
    <div aria-live="polite">
    <Card title={t('panel.title')}>
      <div className="flex items-center gap-2 bg-info-bg text-info-text text-xs rounded-control px-3 py-2 mb-3">
        <Icon of={Info} size={14} />
        <span>{t('panel.disclaimer')}</span>
      </div>
      {evaluation.warnings.length > 0 && (
        <ul className="mb-4 space-y-2">
          {evaluation.warnings
            .filter((w) => WARNING_LABEL_KEYS[w.type])
            .map((w, i) => (
              <li
                key={i}
                className="rounded-card border border-warning-border bg-warning-bg/60 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Icon of={WARNING_ICONS[w.type] ?? AlertTriangle} size={15} className="shrink-0 text-warning-text" />
                  <span className="font-semibold text-ink-primary">{t(WARNING_LABEL_KEYS[w.type])}</span>
                  <span className="ml-auto inline-flex items-center rounded-full bg-warning-text/15 px-2 py-0.5 text-xs font-semibold text-warning-text tnum">
                    %{Math.round(w.confidence * 100)}
                  </span>
                </div>
                {/* AI GEREKÇESİ (rationale) — DB'den gelen model çıktısı, ÇEVRİLMEZ (Faz 3 kapsamı) */}
                <p className="mt-1.5 pl-[23px] leading-relaxed text-ink-secondary">{w.rationale}</p>
              </li>
            ))}
        </ul>
      )}
      <div className="rounded-card border border-line bg-surface-1 p-3">
        <h4 className="mb-1 font-display text-sm text-ink-primary">{t('panel.suitabilityTitle')}</h4>
        {/* suitability_note — AI ÜRETİLEN İÇERİK, DB'den gelen model çıktısı, ÇEVRİLMEZ (Faz 3 kapsamı) */}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">{evaluation.suitability_note}</p>
      </div>
      {canGiveFeedback && doctorId && (
        <FeedbackSection requestId={requestId} aiEvaluationId={evaluation.id} doctorId={doctorId} />
      )}
    </Card>
    </div>
  )
}
