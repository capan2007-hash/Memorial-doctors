import { useMemo, useState } from 'react'
import { useDoctorPerformance } from './useDoctors'
import type { DoctorPerformanceRow } from './useDoctors'
import { scoreTier } from '../../domain/score'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { ArrowDown, ArrowUp, Users, AlertTriangle, Gauge, Clock, type LucideIcon } from 'lucide-react'
import { toDateInputValue, startOfDayIso, endOfDayIso } from '../../lib/format'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { Input } from '@/components/shadcn/input'
import { Skeleton } from '@/components/shadcn/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shadcn/table'

/** scoreTier'in tier zeminini (score.ts) yüzey-üstü semantik tinte eşler — eşik mantığı tekrarlanmaz. */
const TIER_PILL: Record<string, string> = {
  'bg-rose-50': 'bg-danger-bg text-danger-text',
  'bg-amber-50': 'bg-warning-bg text-warning-text',
  'bg-brand-50': 'bg-success-bg text-success-text',
}

/** Skor barının katı dolgu rengi (tier eşiğine göre). */
const TIER_BAR: Record<string, string> = {
  'bg-rose-50': 'bg-danger-text',
  'bg-amber-50': 'bg-warning-text',
  'bg-brand-50': 'bg-brand-fill',
}

/** Dakikayı saat + dakikaya böler (ayrı ayrı gösterim için). */
function splitMins(n: number): { h: number; m: number } {
  const r = Math.round(n)
  return { h: Math.floor(r / 60), m: r % 60 }
}

/** Yanıt süresini "4 sa 37 dk" olarak — sayılar büyük/koyu, birimler küçük/soluk. */
function ResponseTime({ mins, size = 'sm' }: { mins: number | null; size?: 'sm' | 'lg' }) {
  if (mins == null) return <span className="text-ink-muted">—</span>
  const { h, m } = splitMins(mins)
  const num = size === 'lg' ? 'font-display text-2xl' : 'font-semibold'
  const unit = size === 'lg' ? 'text-sm' : 'text-xs'
  return (
    <span className="tnum inline-flex items-baseline gap-0.5 text-ink-primary">
      {h > 0 && (
        <>
          <span className={num}>{h}</span>
          <span className={`${unit} text-ink-muted`}>sa</span>
        </>
      )}
      <span className={`${num} ${h > 0 ? 'ml-1' : ''}`}>{m}</span>
      <span className={`${unit} text-ink-muted`}>dk</span>
    </span>
  )
}

/** Sıralama madalyası: ilk 3 metalik, kalanlar soluk numara. */
const MEDAL: Record<number, { bg: string; color: string; ring: string }> = {
  1: { bg: '#FBEFC9', color: '#8A6D1B', ring: '#E9CE7A' },
  2: { bg: '#ECEEF1', color: '#5B636E', ring: '#CBD1D9' },
  3: { bg: '#F3E2D3', color: '#8A5A34', ring: '#D8B48F' },
}
function RankBadge({ rank }: { rank: number }) {
  const m = MEDAL[rank]
  if (m) {
    return (
      <span
        className="tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1"
        style={{ backgroundColor: m.bg, color: m.color, boxShadow: `inset 0 0 0 1px ${m.ring}` }}
      >
        {rank}
      </span>
    )
  }
  return (
    <span className="tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-ink-muted">
      {rank}
    </span>
  )
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

function MetricTile({ label, value, icon, alarm = false, children }: {
  label: string; value?: string | number; icon: LucideIcon; alarm?: boolean; children?: React.ReactNode
}) {
  return (
    <div className={`rounded-card border p-4 ${alarm ? 'border-danger-border bg-danger-bg' : 'border-line bg-surface-1'}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${alarm ? 'bg-danger-text/12 text-danger-text' : 'bg-brand-fill/10 text-brand-text'}`}>
          <Icon of={icon} size={15} />
        </span>
        <p className={`text-[13px] ${alarm ? 'text-danger-text' : 'text-ink-muted'}`}>{label}</p>
      </div>
      <div className={`mt-2 font-display text-2xl tnum ${alarm ? 'text-danger-text' : 'text-ink-primary'}`}>
        {children ?? value}
      </div>
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

  // Skor sıralaması (tablo sıralamasından bağımsız) → madalya için sabit sıra.
  const scoreRank = useMemo(() => {
    const byScore = [...rows].sort((a, b) => b.score - a.score)
    const map = new Map<string, number>()
    byScore.forEach((r, i) => map.set(r.doctor_id, i + 1))
    return map
  }, [rows])

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="block">
            <TabsList>
              <TabsTrigger value="all">Tüm zaman</TabsTrigger>
              <TabsTrigger value="last30">Son 30 gün</TabsTrigger>
              <TabsTrigger value="custom">Özel aralık</TabsTrigger>
            </TabsList>
          </Tabs>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <Input type="date" className="w-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-sm text-ink-muted">–</span>
              <Input type="date" className="w-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
        </div>

        {perf.isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-card border border-line bg-surface-1 p-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-3 h-7 w-16" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        )}

        {!perf.isLoading && rows.length === 0 && (
          <EmptyState title="Doktor bulunamadı" />
        )}

        {!perf.isLoading && rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricTile label="Toplam doktor" value={totalDoctors} icon={Users} />
              <MetricTile label="Çalışılmaz" value={unworkableCount} icon={AlertTriangle} alarm={unworkableCount > 0} />
              <MetricTile label="Ortalama skor" value={avgScore} icon={Gauge} />
              <MetricTile label="Ortalama yanıt süresi" icon={Clock}>
                <ResponseTime mins={avgResponse} size="lg" />
              </MetricTile>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((col, i) => (
                    <TableHead key={col.key} className={`whitespace-nowrap text-xs uppercase tracking-wide ${i === 0 ? '' : 'text-right'}`}>
                      <button
                        type="button"
                        className={`inline-flex items-center rounded transition-colors hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40 ${i === 0 ? '' : 'flex-row-reverse'}`}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        <SortIndicator active={sortKey === col.key} dir={sortDir} />
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((r) => {
                  const tier = scoreTier(r.score)
                  const barColor = TIER_BAR[tier.bg] ?? 'bg-brand-fill'
                  return (
                    <TableRow
                      key={r.doctor_id}
                      className={`cursor-pointer ${r.is_active ? '' : 'opacity-60'}`}
                      onClick={() => onSelectDoctor(r.doctor_id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <RankBadge rank={scoreRank.get(r.doctor_id) ?? 0} />
                          <div className="min-w-0">
                            <p className="truncate text-ink-primary">
                              {r.title || '(unvan yok)'}
                              {!r.is_active && <span className="ml-1 text-xs text-ink-muted">(pasif)</span>}
                            </p>
                            <p className="truncate text-xs text-ink-muted">{r.specialty || '—'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-line sm:block">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(2, Math.min(100, r.score))}%` }} />
                          </div>
                          <span className="tnum w-6 text-right font-semibold text-ink-primary">{r.score}</span>
                          {tier.label && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_PILL[tier.bg] ?? 'bg-success-bg text-success-text'}`}>
                              {tier.label}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tnum text-right text-ink-primary">{r.accept_count}</TableCell>
                      <TableCell className="tnum text-right text-ink-secondary">{r.reject_count}</TableCell>
                      <TableCell className="text-right"><ResponseTime mins={r.avg_response_mins} /></TableCell>
                      <TableCell className={`tnum text-right ${r.timely_count > 0 ? 'text-success-text' : 'text-ink-muted'}`}>{r.timely_count}</TableCell>
                      <TableCell className={`tnum text-right ${r.breach_count > 0 ? 'text-danger-text' : 'text-ink-muted'}`}>{r.breach_count}</TableCell>
                      <TableCell className={`tnum text-right ${r.pending_count > 0 ? 'text-warning-text' : 'text-ink-muted'}`}>{r.pending_count}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </Card>
  )
}
