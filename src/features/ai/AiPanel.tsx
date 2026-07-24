import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ImageOff, FileWarning, Ruler, Info, Check } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { Input } from '@/components/shadcn/input'
import { useAiEvaluation, useAiFeedbackFor } from './useAiEvaluation'
import { useSubmitAiFeedback } from './useAiFeedback'
import type { AiFeedbackRow } from '../../types/db'

const POLL_GIVE_UP_MS = 120_000

const WARNING_LABELS: Record<string, string> = {
  photo_operation_mismatch: 'Fotoğraf–operasyon uyumsuzluğu',
  demographics_operation_risk: 'Demografi–operasyon riski',
  missing_data: 'Eksik veri',
  photo_quality: 'Fotoğraf kalitesi',
}

const WARNING_ICONS: Record<string, LucideIcon> = {
  photo_operation_mismatch: ImageOff,
  demographics_operation_risk: Ruler,
  missing_data: FileWarning,
  photo_quality: AlertTriangle,
}

const FEEDBACK_LABELS: Record<AiFeedbackRow['label'], string> = {
  correct: 'Doğru',
  partial: 'Kısmen doğru',
  wrong: 'Yanlış',
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
  const existing = useAiFeedbackFor(aiEvaluationId, doctorId)
  const submit = useSubmitAiFeedback()
  const [selected, setSelected] = useState<AiFeedbackRow['label'] | null>(null)
  const [note, setNote] = useState('')

  if (existing.data) {
    return (
      <div className="mt-4 pt-3 border-t border-line">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-text text-xs font-medium px-3 py-1">
          <Icon of={Check} size={13} />
          Geri bildiriminiz: {FEEDBACK_LABELS[existing.data.label]}
        </span>
        {existing.data.note && (
          <p className="text-sm text-ink-secondary mt-2">{existing.data.note}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 pt-3 border-t border-line space-y-2">
      <p className="text-sm text-ink-secondary">Bu değerlendirme:</p>
      <div className="flex gap-2 flex-wrap">
        {FEEDBACK_OPTIONS.map((label) => (
          <Button
            key={label}
            type="button"
            variant={selected === label ? 'primary' : 'secondary'}
            onClick={() => setSelected(label)}
          >
            {FEEDBACK_LABELS[label]}
          </Button>
        ))}
      </div>
      <Input
        type="text"
        placeholder="İsteğe bağlı not"
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
        Gönder
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
  // Veri null kaldıkça React Query yeni render tetiklemez; süre kontrolü
  // ancak zamanlayıcıyla zorlanan bir render'da yeniden değerlendirilebilir.
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), POLL_GIVE_UP_MS)
    return () => clearTimeout(t)
  }, [requestId])
  const q = useAiEvaluation(requestId)

  if (q.isLoading || (q.data == null && !gaveUp)) {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-ink-muted px-1">
        <Spinner />
        <span>AI değerlendirmesi hazırlanıyor…</span>
      </div>
    )
  }

  if (!q.data) return null

  const evaluation = q.data

  if (evaluation.status === 'failed') {
    return (
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-ink-muted px-1">
        <Icon of={AlertTriangle} size={15} />
        AI değerlendirmesi yapılamadı
      </p>
    )
  }

  return (
    <div aria-live="polite">
    <Card title="AI Triyaj Değerlendirmesi">
      <div className="flex items-center gap-2 bg-info-bg text-info-text text-xs rounded-control px-3 py-2 mb-3">
        <Icon of={Info} size={14} />
        <span>Yön göstericidir; nihai karar hekimindir.</span>
      </div>
      {evaluation.warnings.length > 0 && (
        <ul className="mb-4 space-y-2">
          {evaluation.warnings
            .filter((w) => WARNING_LABELS[w.type])
            .map((w, i) => (
              <li
                key={i}
                className="rounded-card border border-warning-border bg-warning-bg/60 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Icon of={WARNING_ICONS[w.type] ?? AlertTriangle} size={15} className="shrink-0 text-warning-text" />
                  <span className="font-semibold text-ink-primary">{WARNING_LABELS[w.type]}</span>
                  <span className="ml-auto inline-flex items-center rounded-full bg-warning-text/15 px-2 py-0.5 text-xs font-semibold text-warning-text tnum">
                    %{Math.round(w.confidence * 100)}
                  </span>
                </div>
                <p className="mt-1.5 pl-[23px] leading-relaxed text-ink-secondary">{w.rationale}</p>
              </li>
            ))}
        </ul>
      )}
      <div className="rounded-card border border-line bg-surface-1 p-3">
        <h4 className="mb-1 font-display text-sm text-ink-primary">Uygunluk değerlendirmesi</h4>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">{evaluation.suitability_note}</p>
      </div>
      {canGiveFeedback && doctorId && (
        <FeedbackSection requestId={requestId} aiEvaluationId={evaluation.id} doctorId={doctorId} />
      )}
    </Card>
    </div>
  )
}
