import { useMemo, useState } from 'react'
import { useDoctorPerformance } from './useDoctors'
import type { DoctorPerformanceRow } from './useDoctors'
import { scoreTier } from '../../domain/score'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatMins, toDateInputValue, startOfDayIso, endOfDayIso } from '../../lib/format'

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
  return <span className="text-brand-700">{dir === 'asc' ? ' ↑' : ' ↓'}</span>
}

function MetricTile({ label, value, alarm = false }: { label: string; value: string | number; alarm?: boolean }) {
  return (
    <Card className={alarm ? 'bg-rose-50' : undefined}>
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className={`text-2xl font-medium ${alarm ? 'text-rose-700' : 'text-slate-900'}`}>{value}</p>
    </Card>
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
          <Button type="button" variant={period === 'all' ? 'primary' : 'secondary'} onClick={() => setPeriod('all')}>
            Tüm zaman
          </Button>
          <Button type="button" variant={period === 'last30' ? 'primary' : 'secondary'} onClick={() => setPeriod('last30')}>
            Son 30 gün
          </Button>
          <Button type="button" variant={period === 'custom' ? 'primary' : 'secondary'} onClick={() => setPeriod('custom')}>
            Özel aralık
          </Button>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-slate-400 text-sm">–</span>
              <input
                type="date"
                className="rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
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
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="py-2 pr-4 font-medium whitespace-nowrap">
                        <button
                          type="button"
                          className="inline-flex items-center hover:text-slate-700"
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
                        className={`border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 ${r.is_active ? '' : 'opacity-60'}`}
                        onClick={() => onSelectDoctor(r.doctor_id)}
                      >
                        <td className="py-2 pr-4">
                          <p className="text-slate-900">
                            {r.title || '(unvan yok)'}
                            {!r.is_active && <span className="ml-1 text-xs text-slate-400">(pasif)</span>}
                          </p>
                          <p className="text-xs text-slate-500">{r.specialty || '—'}</p>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tier.bg} ${tier.text}`}>
                            {r.score}
                            {tier.label && <span className="font-semibold">{tier.label}</span>}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{r.accept_count}</td>
                        <td className="py-2 pr-4">{r.reject_count}</td>
                        <td className="py-2 pr-4">{r.avg_response_mins != null ? formatMins(r.avg_response_mins) : '—'}</td>
                        <td className="py-2 pr-4">{r.timely_count}</td>
                        <td className="py-2 pr-4">{r.breach_count}</td>
                        <td className="py-2 pr-4">{r.pending_count}</td>
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
