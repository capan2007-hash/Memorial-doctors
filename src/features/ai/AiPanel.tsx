import { useRef, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
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
      <div className="mt-4 pt-3 border-t border-slate-100">
        <span className="inline-block rounded-full bg-brand-100 text-brand-700 text-xs font-medium px-3 py-1">
          Geri bildiriminiz: {FEEDBACK_LABELS[existing.data.label]}
        </span>
        {existing.data.note && (
          <p className="text-sm text-slate-600 mt-2">{existing.data.note}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
      <p className="text-sm text-slate-700">Bu değerlendirme:</p>
      <div className="flex gap-2 flex-wrap">
        {FEEDBACK_OPTIONS.map((label) => (
          <Button
            key={label}
            type="button"
            variant="secondary"
            className={selected === label ? 'ring-2 ring-brand-600' : ''}
            onClick={() => setSelected(label)}
          >
            {FEEDBACK_LABELS[label]}
          </Button>
        ))}
      </div>
      <input
        type="text"
        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
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
  const mountedAt = useRef(Date.now())
  const q = useAiEvaluation(requestId)

  if (q.isLoading || (q.data == null && Date.now() - mountedAt.current <= POLL_GIVE_UP_MS)) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 px-1">
        <Spinner />
        <span>AI değerlendirmesi hazırlanıyor…</span>
      </div>
    )
  }

  if (!q.data) return null

  const evaluation = q.data

  if (evaluation.status === 'failed') {
    return <p className="text-sm text-slate-500 px-1">AI değerlendirmesi yapılamadı</p>
  }

  return (
    <Card title="AI Triyaj Değerlendirmesi">
      <div className="bg-accent-100 text-accent-700 text-xs rounded-lg px-3 py-2 mb-3">
        Yön göstericidir; nihai karar hekimindir.
      </div>
      {evaluation.warnings.length > 0 && (
        <ul className="space-y-2 mb-4">
          {evaluation.warnings
            .filter((w) => WARNING_LABELS[w.type])
            .map((w, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{WARNING_LABELS[w.type]}</span>
                  <span className="inline-block rounded-full bg-accent-100 text-accent-700 text-xs font-medium px-2 py-0.5">
                    %{Math.round(w.confidence * 100)}
                  </span>
                </div>
                <p className="text-slate-600 mt-0.5">{w.rationale}</p>
              </li>
            ))}
        </ul>
      )}
      <h4 className="font-display text-sm text-slate-900 mb-1">Uygunluk değerlendirmesi</h4>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{evaluation.suitability_note}</p>
      {canGiveFeedback && doctorId && (
        <FeedbackSection requestId={requestId} aiEvaluationId={evaluation.id} doctorId={doctorId} />
      )}
    </Card>
  )
}
