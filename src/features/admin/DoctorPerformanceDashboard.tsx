import { useMemo, useState } from 'react'
import { useDoctorPerformance } from './useDoctors'
import type { DoctorPerformanceRow } from './useDoctors'
import { scoreTier } from '../../domain/score'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatMins, toDateInputValue, startOfDayIso, endOfDayIso } from '../../lib/format'

/** scoreTier'in tier zeminini (score.ts) yüzey-üstü semantik tinte eşler — eşik mantığı tekrarlanmaz. */
const TIER_PILL: Record<string, string> = {
  'bg-rose-50': 'bg-danger-bg text-danger-text',
  'bg-amber-50': 'bg-warning-bg text-warning-text',
  'bg-brand-50': 'bg-success-bg text-success-text',
}

type Period = 'all' | 'last30' | 'custom'

type SortKey = 'title' | 'score' | 'accept_count' | 'reject_count' | 'avg_response_mins' | 'timely_count' | 'breach_count' | 'pending_count'
type SortDir = 'asc' | 'desc'

interface Column { key: SortKey; label: string }

const COLUMNS: Column[] = [
  { key: 'title', label: 'Doktor' },
  { key: 'score', label: 'Skor' },
  { key: 'accept_count', label: 'Kabul' },
  { key: 'reject_count', label: 'Red' },
  { key: 'avg_response_mins', label: 'Ort. yanıt' },
  { key: 'timely_count', label: 'Zamanında' },
  { key: 'breach_count', label: 'Geç' },
  { key: 'pending_count', label: 'Bekleyen' },
]

function compareRows(a: DoctorPerformanceRow, b: DoctorPerformanceRow, key: SortKey): number {
  if (key === 'title') {
    const an = a.title ?? ''
    const bn = b.title ?? ''
    return an.localeCompare(bn, 'tr')
  }
  // null (ör. yanıt süresi yok) en sona: iki null eşit (NaN karşılaştırması olmasın).
  const av = a[key]
  const bv = b[key]
  if (av == null && bv == null) return 0
  if (av == null) return -1
  if (bv == null) return 1
  return av - bv
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null
  return <Icon of={dir === 'asc' ? ArrowUp : ArrowDown} size={13} className="text-brand-text ml-0.5" />
}

function MetricTile({ label, value, alarm = false }: { label: string; value: string | number; alarm?: boolean }) {
  return (
    <div className={`rounded-card border border-line p-4 ${alarm ? 'bg-danger-bg' : 'bg-surface-1'}`}>
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className={`text-2xl font-display tnum ${alarm ? 'text-danger-text' : 'text-ink-primary'}`}>{value}</p>
    </div>
  )
}

/** Yönetici performans panosu: dönem filtresi + özet karolar + sıralanabilir doktor tablosu (RPC doctor_performance_summary). */
export function DoctorPerformanceDashboard({ onSelectDoctor }: { onSelectDoctor: (doctorId: string) => void }) {
  const [period, setPeriod] = useState<Period>('all')
  const now = useMemo(() => new Date(), [])
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(new Date(now.getTime() - 30 * 86_400_000)))
  const [customTo, setCustomTo] = useState(() => toDateInputValue(now))

  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { from, to } = useMemo(() => {
    if (period === 'last30') {
      return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString(), to: now.toISOString() }
    }
    if (period === 'custom') {
      return { from: startOfDayIso(customFrom), to: endOfDayIso(customTo) }
    }
    return { from: undefined, to: undefined }
  }, [period, now, customFrom, customTo])

  const perf = useDoctorPerformance(from, to)
  const rows = perf.data ?? []

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const cmp = compareRows(a, b, sortKey)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'title' ? 'asc' : 'desc')
    }
  }

  const totalDoctors = rows.length
  const unworkableCount = rows.filter((r) => r.score < 10).length
  const avgScore = totalDoctors ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / totalDoctors) : 0
  const responseRows = rows.filter((r) => r.avg_response_mins != null)
  const avgResponse = responseRows.length
    ? responseRows.reduce((sum, r) => sum + (r.avg_response_mins as number), 0) / responseRows.length
    : null

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'last30', 'custom'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`text-sm px-3 py-1.5 rounded-control border transition ease-premium duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40 ${
                period === p
                  ? 'bg-brand-fill border-brand-fill text-brand-on'
                  : 'bg-surface-2 border-line text-ink-secondary hover:border-line-strong'
              }`}
            >
              {p === 'all' ? 'Tüm zaman' : p === 'last30' ? 'Son 30 gün' : 'Özel aralık'}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="rounded-control border border-line bg-surface-1 p-2 text-sm text-ink-primary focus:outline-none focus:border-brand-fill focus:ring-2 focus:ring-brand-fill/20"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-ink-muted text-sm">–</span>
              <input
                type="date"
                className="rounded-control border border-line bg-surface-1 p-2 text-sm text-ink-primary focus:outline-none focus:border-brand-fill focus:ring-2 focus:ring-brand-fill/20"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>

        {perf.isLoading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        {!perf.isLoading && rows.length === 0 && (
          <EmptyState title="Doktor bulunamadı" />
        )}

        {!perf.isLoading && rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricTile label="Toplam doktor" value={totalDoctors} />
              <MetricTile label="Çalışılmaz" value={unworkableCount} alarm={unworkableCount > 0} />
              <MetricTile label="Ortalama skor" value={avgScore} />
              <MetricTile label="Ortalama yanıt süresi" value={avgResponse != null ? formatMins(avgResponse) : '—'} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted text-xs uppercase tracking-wide">
                    {COLUMNS.map((col, i) => (
                      <th key={col.key} className={`py-2 pr-4 font-medium whitespace-nowrap ${i === 0 ? '' : 'text-right'}`}>
                        <button
                          type="button"
                          className={`inline-flex items-center hover:text-ink-primary transition ease-premium duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40 rounded ${i === 0 ? '' : 'flex-row-reverse'}`}
                          onClick={() => toggleSort(col.key)}
                        >
                          {col.label}
                          <SortIndicator active={sortKey === col.key} dir={sortDir} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => {
                    const tier = scoreTier(r.score)
                    return (
                      <tr
                        key={r.doctor_id}
                        className={`border-b border-line last:border-0 cursor-pointer hover:bg-surface-1 transition ease-premium duration-[var(--dur-fast)] ${r.is_active ? '' : 'opacity-60'}`}
                        onClick={() => onSelectDoctor(r.doctor_id)}
                      >
                        <td className="py-2 pr-4">
                          <p className="text-ink-primary">
                            {r.title || '(unvan yok)'}
                            {!r.is_active && <span className="ml-1 text-xs text-ink-muted">(pasif)</span>}
                          </p>
                          <p className="text-xs text-ink-muted">{r.specialty || '—'}</p>
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TIER_PILL[tier.bg] ?? 'bg-success-bg text-success-text'}`}>
                            <span className="tnum">{r.score}</span>
                            {tier.label && <span className="font-semibold">{tier.label}</span>}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right tnum">{r.accept_count}</td>
                        <td className="py-2 pr-4 text-right tnum">{r.reject_count}</td>
                        <td className="py-2 pr-4 text-right tnum">{r.avg_response_mins != null ? formatMins(r.avg_response_mins) : '—'}</td>
                        <td className="py-2 pr-4 text-right tnum">{r.timely_count}</td>
                        <td className="py-2 pr-4 text-right tnum">{r.breach_count}</td>
                        <td className="py-2 pr-4 text-right tnum">{r.pending_count}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
