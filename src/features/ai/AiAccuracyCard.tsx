import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import type { AiFeedbackRow } from '../../types/db'

type Label = AiFeedbackRow['label']

interface LabelStat {
  label: Label
  name: string
  count: number
  pct: number
  textClass: string
  barClass: string
}

const LABEL_ORDER: Label[] = ['correct', 'partial', 'wrong']

const LABEL_META: Record<Label, { textClass: string; barClass: string }> = {
  correct: { textClass: 'text-success-text', barClass: 'bg-success-text' },
  partial: { textClass: 'text-warning-text', barClass: 'bg-warning-text' },
  wrong: { textClass: 'text-danger-text', barClass: 'bg-danger-text' },
}

/** Koordinatör/admin için AI değerlendirmelerine verilen doktor geri bildirimlerinin özeti. */
function useAiAccuracy() {
  return useQuery({
    queryKey: ['ai-accuracy'],
    queryFn: async (): Promise<Record<Label, number>> => {
      const { data, error } = await supabase.from('ai_feedback').select('label')
      if (error) throw error
      const counts: Record<Label, number> = { correct: 0, partial: 0, wrong: 0 }
      for (const row of (data ?? []) as Pick<AiFeedbackRow, 'label'>[]) {
        counts[row.label] += 1
      }
      return counts
    },
  })
}

export function AiAccuracyCard() {
  const { t } = useTranslation('ai')
  const q = useAiAccuracy()

  return (
    <Card title={t('accuracy.title')} className="mb-4">
      {q.isLoading && (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Spinner />
          <span>{t('accuracy.loading')}</span>
        </div>
      )}
      {!q.isLoading && q.data && <AiAccuracyBody counts={q.data} t={t} />}
    </Card>
  )
}

function AiAccuracyBody({ counts, t }: { counts: Record<Label, number>; t: TFunction }) {
  const total = LABEL_ORDER.reduce((sum, label) => sum + counts[label], 0)

  if (total === 0) {
    return <p className="text-sm text-ink-muted">{t('accuracy.empty')}</p>
  }

  const stats: LabelStat[] = LABEL_ORDER.map((label) => {
    const count = counts[label]
    const pct = Math.round((count / total) * 100)
    return { label, name: t(`feedback.${label}`), count, pct, ...LABEL_META[label] }
  })

  return (
    <div>
      <div className="flex gap-4 flex-wrap mb-3">
        {stats.map((s) => (
          <div key={s.label} className="text-sm">
            <span className={`font-medium ${s.textClass}`}>{s.name}</span>
            <span className="text-ink-muted tnum"> — {s.count} (%{s.pct})</span>
          </div>
        ))}
      </div>
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-surface-3">
        {stats
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.label}
              className={s.barClass}
              style={{ width: `${s.pct}%` }}
              title={t('accuracy.barTooltip', { name: s.name, pct: s.pct })}
            />
          ))}
      </div>
    </div>
  )
}
