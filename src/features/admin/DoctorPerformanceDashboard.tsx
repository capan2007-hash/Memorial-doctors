import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDoctorPerformance } from './useDoctors'
import type { DoctorPerformanceRow } from './useDoctors'
import { scoreTier } from '../../domain/score'
import { EmptyState } from '../../components/ui/EmptyState'
import { Avatar } from '../../components/ui/Avatar'
import { Icon } from '../../components/ui/Icon'
import { TranslatedText } from '../i18n-content/TranslatedText'
import {
  ArrowDown, ArrowUp, Users, AlertTriangle, Gauge, Clock, Search, MoreVertical,
  ChevronLeft, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { toDateInputValue, startOfDayIso, endOfDayIso } from '../../lib/format'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { Input } from '@/components/shadcn/input'
import { Skeleton } from '@/components/shadcn/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shadcn/table'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/shadcn/dropdown-menu'

/** scoreTier'in tier zeminini (score.ts) yüzey-üstü semantik tinte eşler. */
const TIER_PILL: Record<string, string> = {
  'bg-rose-50': 'bg-danger-bg text-danger-text',
  'bg-amber-50': 'bg-warning-bg text-warning-text',
  'bg-brand-50': 'bg-success-bg text-success-text',
}

// scoreTier (domain/score.ts) yalnız 'bg-rose-50' zeminde sabit bir uyarı etiketi döndürür ("Çalışılmaz").
// domain dosyası paylaşımlı ve değiştirilmedi; çeviri call-site'ta, tier.bg kararlı kimliğine göre yapılır.
const TIER_LABEL_KEY: Record<string, string> = { 'bg-rose-50': 'doctorPerformance.unworkableTierBadge' }

const PAGE_SIZE = 8

/** Dakikayı saat + dakikaya böler (ayrı ayrı gösterim için). */
function splitMins(n: number): { h: number; m: number } {
  const r = Math.round(n)
  return { h: Math.floor(r / 60), m: r % 60 }
}

/** Yanıt süresini "4 sa 37 dk" olarak — sayılar büyük/koyu, birimler küçük/soluk. */
function ResponseTime({ mins, size = 'sm' }: { mins: number | null; size?: 'sm' | 'lg' }) {
  const { t } = useTranslation('admin')
  if (mins == null) return <span className="text-ink-muted">—</span>
  const { h, m } = splitMins(mins)
  const num = size === 'lg' ? 'font-display text-2xl' : 'font-semibold'
  const unit = size === 'lg' ? 'text-sm' : 'text-xs'
  return (
    <span className="tnum inline-flex items-baseline gap-0.5 text-ink-primary">
      {h > 0 && (
        <>
          <span className={num}>{h}</span>
          <span className={`${unit} text-ink-muted`}>{t('doctorPerformance.hoursSuffix')}</span>
        </>
      )}
      <span className={`${num} ${h > 0 ? 'ms-1' : ''}`}>{m}</span>
      <span className={`${unit} text-ink-muted`}>{t('doctorPerformance.minutesSuffix')}</span>
    </span>
  )
}

/** Gerçek verilerden mini çubuk grafik (takım dağılımı — zaman trendi değil). */
function Sparkbars({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${color}`}
          style={{ height: `${Math.max(10, (v / max) * 100)}%`, opacity: 0.35 + 0.55 * (v / max) }}
        />
      ))}
    </div>
  )
}

function MetricTile({ label, icon, alarm = false, sublabel, spark, children }: {
  label: string; icon: LucideIcon; alarm?: boolean; sublabel?: string
  spark?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className={`rounded-card border p-4 shadow-card ${alarm ? 'border-danger-border bg-danger-bg' : 'border-line bg-surface-2'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${alarm ? 'bg-danger-text/12 text-danger-text' : 'bg-brand-fill/10 text-brand-text'}`}>
              <Icon of={icon} size={15} />
            </span>
            <p className={`text-[13px] ${alarm ? 'text-danger-text' : 'text-ink-muted'}`}>{label}</p>
          </div>
          <div className={`mt-2 font-display text-2xl tnum ${alarm ? 'text-danger-text' : 'text-ink-primary'}`}>{children}</div>
          {sublabel && <p className={`mt-1 text-xs ${alarm ? 'text-danger-text/80' : 'text-ink-muted'}`}>{sublabel}</p>}
        </div>
        {spark && <div className="w-16 shrink-0 self-end">{spark}</div>}
      </div>
    </div>
  )
}

type Period = 'all' | 'last30' | 'custom'

type SortKey = 'title' | 'score' | 'accept_count' | 'reject_count' | 'avg_response_mins' | 'timely_count' | 'breach_count' | 'pending_count'
type SortDir = 'asc' | 'desc'

interface Column { key: SortKey; label: string }

function compareRows(a: DoctorPerformanceRow, b: DoctorPerformanceRow, key: SortKey): number {
  if (key === 'title') {
    return (a.title ?? '').localeCompare(b.title ?? '', 'tr')
  }
  const av = a[key]
  const bv = b[key]
  if (av == null && bv == null) return 0
  if (av == null) return -1
  if (bv == null) return 1
  return av - bv
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null
  return <Icon of={dir === 'asc' ? ArrowUp : ArrowDown} size={13} className="ms-0.5 text-brand-text" />
}

/** Yönetici performans panosu (ayrı raporlama sekmesi): dönem + arama + özet karolar + sıralanabilir/sayfalanabilir tablo. */
export function DoctorPerformanceDashboard({ onSelectDoctor }: { onSelectDoctor: (doctorId: string) => void }) {
  const { t } = useTranslation('admin')
  const COLUMNS: Column[] = [
    { key: 'title', label: t('doctorPerformance.columns.doctor') },
    { key: 'score', label: t('doctorPerformance.columns.score') },
    { key: 'accept_count', label: t('doctorPerformance.columns.accept') },
    { key: 'reject_count', label: t('doctorPerformance.columns.reject') },
    { key: 'avg_response_mins', label: t('doctorPerformance.columns.avgResponse') },
    { key: 'timely_count', label: t('doctorPerformance.columns.timely') },
    { key: 'breach_count', label: t('doctorPerformance.columns.breach') },
    { key: 'pending_count', label: t('doctorPerformance.columns.pending') },
  ]
  const [period, setPeriod] = useState<Period>('all')
  const now = useMemo(() => new Date(), [])
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(new Date(now.getTime() - 30 * 86_400_000)))
  const [customTo, setCustomTo] = useState(() => toDateInputValue(now))

  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { from, to } = useMemo(() => {
    if (period === 'last30') return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString(), to: now.toISOString() }
    if (period === 'custom') return { from: startOfDayIso(customFrom), to: endOfDayIso(customTo) }
    return { from: undefined, to: undefined }
  }, [period, now, customFrom, customTo])

  const perf = useDoctorPerformance(from, to)
  const rows = perf.data ?? []

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    if (!q) return rows
    return rows.filter((r) =>
      (r.title ?? '').toLocaleLowerCase('tr').includes(q) ||
      (r.specialty ?? '').toLocaleLowerCase('tr').includes(q))
  }, [rows, search])

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows]
    copy.sort((a, b) => {
      const cmp = compareRows(a, b, sortKey)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filteredRows, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageRows = sortedRows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'title' ? 'asc' : 'desc') }
    setPage(0)
  }

  const totalDoctors = rows.length
  const activeDoctors = rows.filter((r) => r.is_active).length
  const unworkableCount = rows.filter((r) => r.score < 10).length
  const avgScore = totalDoctors ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / totalDoctors) : 0
  const responseRows = rows.filter((r) => r.avg_response_mins != null)
  const avgResponse = responseRows.length
    ? responseRows.reduce((sum, r) => sum + (r.avg_response_mins as number), 0) / responseRows.length
    : null

  const scoreSpark = useMemo(() => [...rows].map((r) => r.score).sort((a, b) => b - a), [rows])
  const responseSpark = useMemo(
    () => rows.filter((r) => r.avg_response_mins != null).map((r) => r.avg_response_mins as number).sort((a, b) => a - b),
    [rows],
  )

  if (perf.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-card border border-line bg-surface-2 p-4 shadow-card">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-card border border-line bg-surface-2 p-4 shadow-card">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface-2 p-4 shadow-card">
        <EmptyState title={t('doctorPerformance.emptyTitle')} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Dönem + arama */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={period} onValueChange={(v) => { setPeriod(v as Period); setPage(0) }} className="block">
            <TabsList>
              <TabsTrigger value="all">{t('doctorPerformance.periodTabs.all')}</TabsTrigger>
              <TabsTrigger value="last30">{t('doctorPerformance.periodTabs.last30')}</TabsTrigger>
              <TabsTrigger value="custom">{t('doctorPerformance.periodTabs.custom')}</TabsTrigger>
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
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} />
          <Input
            className="w-56 ps-9"
            placeholder={t('doctorPerformance.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
      </div>

      {/* Özet karolar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile
          label={t('doctorPerformance.metrics.totalDoctors')} icon={Users}
          sublabel={t('doctorPerformance.metrics.totalDoctorsSublabel', { active: activeDoctors, inactive: totalDoctors - activeDoctors })}
        >
          {totalDoctors}
        </MetricTile>
        <MetricTile
          label={t('doctorPerformance.metrics.unworkable')} icon={AlertTriangle} alarm={unworkableCount > 0}
          sublabel={unworkableCount > 0 ? t('doctorPerformance.metrics.unworkableAttention') : t('doctorPerformance.metrics.unworkableHealthy')}
        >
          {unworkableCount}
        </MetricTile>
        <MetricTile
          label={t('doctorPerformance.metrics.avgScore')} icon={Gauge} sublabel={t('doctorPerformance.metrics.avgScoreSublabel')}
          spark={<Sparkbars values={scoreSpark} color="bg-brand-fill" />}
        >
          {avgScore}
        </MetricTile>
        <MetricTile
          label={t('doctorPerformance.metrics.avgResponse')} icon={Clock} sublabel={t('doctorPerformance.metrics.avgResponseSublabel')}
          spark={<Sparkbars values={responseSpark} color="bg-warning-text" />}
        >
          <ResponseTime mins={avgResponse} size="lg" />
        </MetricTile>
      </div>

      {/* Tablo */}
      <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((col, i) => (
                <TableHead key={col.key} className={`whitespace-nowrap px-4 text-xs uppercase tracking-wide ${i === 0 ? '' : 'text-end'}`}>
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
              <TableHead className="px-4 text-end text-xs uppercase tracking-wide">{t('doctorPerformance.columns.action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((r) => {
              const tier = scoreTier(r.score)
              const tierLabelKey = TIER_LABEL_KEY[tier.bg]
              return (
                <TableRow
                  key={r.doctor_id}
                  className={`cursor-pointer ${r.is_active ? '' : 'opacity-60'}`}
                  onClick={() => onSelectDoctor(r.doctor_id)}
                >
                  <TableCell className="px-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.title || t('doctorPerformance.noTitle')} size="sm" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-ink-primary">
                          {r.title ? (
                            <TranslatedText as="span" text={r.title} sourceLang="tr" compact className="truncate" />
                          ) : (
                            <span className="truncate">{t('doctorPerformance.noTitle')}</span>
                          )}
                          {!r.is_active && (
                            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">{t('doctorPerformance.inactiveBadge')}</span>
                          )}
                        </p>
                        {r.specialty ? (
                          <TranslatedText as="p" text={r.specialty} sourceLang="tr" compact className="truncate text-xs text-ink-muted" />
                        ) : (
                          <p className="truncate text-xs text-ink-muted">—</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-end">
                    <span className={`tnum inline-flex min-w-[2.5rem] items-center justify-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${TIER_PILL[tier.bg] ?? 'bg-success-bg text-success-text'}`}>
                      {r.score}
                      {tierLabelKey && <span className="text-[10px] font-bold uppercase">{t(tierLabelKey)}</span>}
                    </span>
                  </TableCell>
                  <TableCell className="tnum px-4 text-end text-ink-primary">{r.accept_count}</TableCell>
                  <TableCell className="tnum px-4 text-end text-ink-secondary">{r.reject_count}</TableCell>
                  <TableCell className="px-4 text-end"><ResponseTime mins={r.avg_response_mins} /></TableCell>
                  <TableCell className={`tnum px-4 text-end ${r.timely_count > 0 ? 'text-success-text' : 'text-ink-muted'}`}>{r.timely_count}</TableCell>
                  <TableCell className={`tnum px-4 text-end ${r.breach_count > 0 ? 'text-danger-text' : 'text-ink-muted'}`}>{r.breach_count}</TableCell>
                  <TableCell className={`tnum px-4 text-end ${r.pending_count > 0 ? 'text-warning-text' : 'text-ink-muted'}`}>{r.pending_count}</TableCell>
                  <TableCell className="px-4 text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={t('doctorPerformance.actionsAria')}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-1 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icon of={MoreVertical} size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onSelectDoctor(r.doctor_id)}>
                          {t('doctorPerformance.openDoctorCardMenuItem')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
            {pageRows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-sm text-ink-muted">
                  {t('doctorPerformance.emptySearch')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Sayfalama */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-muted">
          <span className="tnum">{t('doctorPerformance.totalShowing', { count: sortedRows.length })}</span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t('doctorPerformance.prevAria')}
                disabled={clampedPage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-secondary transition-colors hover:bg-surface-1 disabled:opacity-40"
              >
                <Icon of={ChevronLeft} size={16} className="rtl:-scale-x-100" />
              </button>
              <span className="tnum px-2 font-medium text-ink-primary">{t('doctorPerformance.pageOf', { current: clampedPage + 1, total: pageCount })}</span>
              <button
                type="button"
                aria-label={t('doctorPerformance.nextAria')}
                disabled={clampedPage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-secondary transition-colors hover:bg-surface-1 disabled:opacity-40"
              >
                <Icon of={ChevronRight} size={16} className="rtl:-scale-x-100" />
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="px-1 text-xs text-ink-muted">
        {t('doctorPerformance.footNote')}
      </p>
    </div>
  )
}
