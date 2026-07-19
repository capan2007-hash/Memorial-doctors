import { useQuery } from '@tanstack/react-query'
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

const LABEL_META: Record<Label, { name: string; textClass: string; barClass: string }> = {
  correct: { name: 'Doğru', textClass: 'text-success-text', barClass: 'bg-success-text' },
  partial: { name: 'Kısmen doğru', textClass: 'text-warning-text', barClass: 'bg-warning-text' },
  wrong: { name: 'Yanlış', textClass: 'text-danger-text', barClass: 'bg-danger-text' },
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
  const q = useAiAccuracy()

  return (
    <Card title="AI Doğruluk Raporu" className="mb-4">
      {q.isLoading && (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Spinner />
          <span>Yükleniyor…</span>
        </div>
      )}
      {!q.isLoading && q.data && <AiAccuracyBody counts={q.data} />}
    </Card>
  )
}

function AiAccuracyBody({ counts }: { counts: Record<Label, number> }) {
  const total = LABEL_ORDER.reduce((sum, label) => sum + counts[label], 0)

  if (total === 0) {
    return <p className="text-sm text-ink-muted">Henüz doktor geri bildirimi yok.</p>
  }

  const stats: LabelStat[] = LABEL_ORDER.map((label) => {
    const count = counts[label]
    const pct = Math.round((count / total) * 100)
    return { label, count, pct, ...LABEL_META[label] }
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
              title={`${s.name}: %${s.pct}`}
            />
          ))}
      </div>
    </div>
  )
}
