import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, Stethoscope, UserRound, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { catalogName } from '../catalog/catalogName'
import {
  activityRoleLabel,
  caseTypeLabel,
  dayGroupLabel,
  dayKey,
  doctorCountText,
  formatActivityDateTime,
  relativeTime,
  roleAccentTone,
  type ActivityTone,
} from '../../domain/activity'
import { useActivityTimeline, type ActivityEntry } from './useActivity'

function roleIcon(role: string): LucideIcon {
  if (role === 'agent') return Building2
  if (role === 'sales') return Briefcase
  return UserRound
}

/** Role tonuna göre literal Tailwind sınıfları (JIT için tam string). */
const TONE: Record<ActivityTone, { strip: string; dot: string; icon: string; badge: string; ping: string }> = {
  info: {
    strip: 'bg-info-border',
    dot: 'bg-info-bg border-info-border',
    icon: 'text-info-text',
    badge: 'bg-info-bg text-info-text border-info-border',
    ping: 'bg-info-border',
  },
  warning: {
    strip: 'bg-warning-border',
    dot: 'bg-warning-bg border-warning-border',
    icon: 'text-warning-text',
    badge: 'bg-warning-bg text-warning-text border-warning-border',
    ping: 'bg-warning-border',
  },
  brand: {
    strip: 'bg-brand-fill',
    dot: 'bg-brand-fill/10 border-brand-fill/40',
    icon: 'text-brand-text',
    badge: 'bg-brand-fill/10 text-brand-text border-brand-fill/30',
    ping: 'bg-brand-fill/40',
  },
}

interface Node {
  entry: ActivityEntry
  index: number
}

function TimelineNode({
  node,
  isLastInGroup,
  t,
  lang,
}: {
  node: Node
  isLastInGroup: boolean
  t: TFunction
  lang: string
}) {
  const { entry, index } = node
  const tone = TONE[roleAccentTone(entry.creator_role)]
  const Icon = roleIcon(entry.creator_role)
  const localizedCategory =
    entry.category_name != null
      ? catalogName({ name: entry.category_name, name_i18n: entry.category_name_i18n }, lang)
      : null
  const localizedSubcategory =
    entry.subcategory_name != null
      ? catalogName({ name: entry.subcategory_name, name_i18n: entry.subcategory_name_i18n }, lang)
      : null
  const caseType = caseTypeLabel(localizedCategory, localizedSubcategory, t)
  const isNewest = index === 0
  const delay = Math.min(index, 12) * 45

  return (
    <li className="activity-in flex gap-3" style={{ animationDelay: `${delay}ms` }}>
      {/* Ray: renkli dot (+ en yeniye nabız) + aşağı akan çizgi */}
      <div className="flex w-8 flex-shrink-0 flex-col items-center pt-0.5">
        <div className="relative">
          {isNewest && (
            <span className={`activity-ping pointer-events-none absolute inset-0 rounded-full ${tone.ping}`} aria-hidden />
          )}
          <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border ${tone.dot}`}>
            <Icon className={`h-4 w-4 ${tone.icon}`} strokeWidth={1.75} />
          </span>
        </div>
        {!isLastInGroup && <span className="mt-1 w-px flex-1 bg-line" aria-hidden />}
      </div>

      {/* İçerik kartı: sol renkli şerit + role rozeti + doktor sayısı.
          Tıklanınca talep detayına gider (satışçı foto+talep+doktor yanıtını görür → mükerrer kontrolü). */}
      <div className="flex-1 pb-4">
        <Link
          to={`/requests/${entry.request_id}`}
          className="relative block overflow-hidden rounded-card border border-line bg-surface-1 p-3 ps-4 shadow-card transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-pop"
        >
          <span className={`absolute inset-y-0 start-0 w-1 ${tone.strip}`} aria-hidden />

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tone.badge}`}
            >
              <Icon className="h-3 w-3" strokeWidth={2} />
              {activityRoleLabel(entry.creator_role, t)}
            </span>
            <span className="font-medium text-ink-primary">{entry.creator_name}</span>
            <span className="ms-auto text-xs text-ink-muted">{relativeTime(entry.created_at, t)}</span>
          </div>

          <p className="mt-1.5 text-sm text-ink-secondary">
            {t('timeline.entryPrefix')} <span className="font-semibold text-ink-primary">{caseType}</span>{' '}
            {t('timeline.entrySuffix')}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-control bg-brand-fill px-2 py-0.5 text-xs font-semibold text-white">
              <Stethoscope className="h-3.5 w-3.5" strokeWidth={2} />
              {doctorCountText(entry.doctor_count, t)}
            </span>
            <span className="tnum text-[11px] text-ink-muted">{formatActivityDateTime(entry.created_at, lang)}</span>
          </div>
        </Link>
      </div>
    </li>
  )
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 pt-1">
      <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
        {label}
      </span>
      <span className="h-px flex-1 bg-line" aria-hidden />
    </div>
  )
}

interface Group {
  key: string
  label: string
  nodes: Node[]
}

type Filter = 'all' | 'sales' | 'agent'

const FILTER_ACTIVE_CLASS: Record<Filter, string> = {
  all: 'border-brand-fill bg-brand-fill text-white',
  sales: 'border-info-border bg-info-bg text-info-text',
  agent: 'border-warning-border bg-warning-bg text-warning-text',
}

function FilterChips({
  value,
  counts,
  onChange,
  t,
}: {
  value: Filter
  counts: Record<Filter, number>
  onChange: (f: Filter) => void
  t: TFunction
}) {
  const FILTERS: { key: Filter; label: string; activeClass: string }[] = [
    { key: 'all', label: t('filters.all'), activeClass: FILTER_ACTIVE_CLASS.all },
    { key: 'sales', label: t('filters.sales'), activeClass: FILTER_ACTIVE_CLASS.sales },
    { key: 'agent', label: t('filters.agent'), activeClass: FILTER_ACTIVE_CLASS.agent },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const active = value === f.key
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
              active ? f.activeClass : 'border-line bg-surface-1 text-ink-secondary hover:border-line-strong'
            }`}
          >
            {f.label}
            <span className={`tnum ${active ? 'opacity-80' : 'text-ink-muted'}`}>{counts[f.key]}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ActivityTimeline() {
  const { t, i18n } = useTranslation('activity')
  const q = useActivityTimeline()
  const [filter, setFilter] = useState<Filter>('all')
  const entries = q.data?.pages.flat() ?? []
  const now = new Date()

  const counts: Record<Filter, number> = {
    all: entries.length,
    sales: entries.filter((e) => e.creator_role === 'sales').length,
    agent: entries.filter((e) => e.creator_role === 'agent').length,
  }

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.creator_role === filter)

  // Süzülmüş girişleri güne göre grupla (sıra korunur: en yeni → eski).
  const groups: Group[] = []
  filtered.forEach((entry, index) => {
    const key = dayKey(entry.created_at)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      g = { key, label: dayGroupLabel(entry.created_at, t, i18n.language, now), nodes: [] }
      groups.push(g)
    }
    g.nodes.push({ entry, index })
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('timeline.title')}
        subtitle={t('timeline.subtitle')}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-secondary">
            <span className="relative flex h-2 w-2">
              <span className="activity-ping absolute inset-0 rounded-full bg-success-text" aria-hidden />
              <span className="relative h-2 w-2 rounded-full bg-success-text" />
            </span>
            {t('timeline.live')}
          </span>
        }
      />

      {entries.length > 0 && <FilterChips value={filter} counts={counts} onChange={setFilter} t={t} />}

      {q.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {q.isError && (
        <div className="rounded-control border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">
          {t('timeline.loadError', { message: (q.error as Error).message })}
        </div>
      )}

      {!q.isLoading && !q.isError && entries.length === 0 && (
        <EmptyState
          title={t('timeline.emptyTitle')}
          description={t('timeline.emptyDescription')}
        />
      )}

      {entries.length > 0 && filtered.length === 0 && (
        <EmptyState title={t('timeline.emptyFilterTitle')} description={t('timeline.emptyFilterDescription')} />
      )}

      {groups.map((group) => (
        <div key={group.key}>
          <GroupHeader label={group.label} />
          <ol>
            {group.nodes.map((node, i) => (
              <TimelineNode
                key={node.entry.request_id}
                node={node}
                isLastInGroup={i === group.nodes.length - 1}
                t={t}
                lang={i18n.language}
              />
            ))}
          </ol>
        </div>
      ))}

      {q.hasNextPage && (
        <div className="flex justify-center pt-1">
          <Button variant="secondary" type="button" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            {t('timeline.loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
