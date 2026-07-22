import { Briefcase, Building2, Stethoscope, UserRound, type LucideIcon } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  activityRoleLabel,
  caseTypeLabel,
  doctorCountText,
  formatActivityDateTime,
} from '../../domain/activity'
import { useActivityTimeline, type ActivityEntry } from './useActivity'

function roleIcon(role: string): LucideIcon {
  if (role === 'agent') return Building2
  if (role === 'sales') return Briefcase
  return UserRound
}

/** Tek timeline düğümü: sol rayda ikon + bağlantı çizgisi, sağda cümle + doktor rozeti. */
function TimelineNode({ entry, isLast }: { entry: ActivityEntry; isLast: boolean }) {
  const Icon = roleIcon(entry.creator_role)
  const caseType = caseTypeLabel(entry.category_name, entry.subcategory_name)
  return (
    <li className="flex gap-3">
      {/* Ray: ikon + aşağıya akan çizgi */}
      <div className="flex w-7 flex-shrink-0 flex-col items-center">
        <span className="z-10 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-2">
          <Icon className="h-3.5 w-3.5 text-ink-secondary" strokeWidth={1.75} />
        </span>
        {!isLast && <span className="w-px flex-1 bg-line" aria-hidden />}
      </div>

      {/* İçerik */}
      <div className="flex-1 pb-5">
        <div className="rounded-card border border-line bg-surface-1 p-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium text-ink-primary">
              {activityRoleLabel(entry.creator_role)} {entry.creator_name}
            </span>
            <span className="tnum text-xs text-ink-muted">{formatActivityDateTime(entry.created_at)}</span>
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            bir <span className="font-medium text-ink-primary">{caseType}</span> vakası girişi yaptı
          </p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-control bg-brand-fill/10 px-2 py-0.5 text-xs font-medium text-brand-text">
            <Stethoscope className="h-3 w-3" strokeWidth={2} />
            {doctorCountText(entry.doctor_count)}
          </div>
        </div>
      </div>
    </li>
  )
}

export function ActivityTimeline() {
  const q = useActivityTimeline()
  const entries = q.data?.pages.flat() ?? []

  return (
    <div className="space-y-4">
      <PageHeader title="Akış" subtitle="Doktorlara yönlendirilen talep girişleri — en yeni önce." />

      {q.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {q.isError && (
        <div className="rounded-control border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">
          Akış alınamadı: {(q.error as Error).message}
        </div>
      )}

      {!q.isLoading && !q.isError && entries.length === 0 && (
        <EmptyState
          title="Henüz akış yok"
          description="Doktorlara yönlendirilen talepler burada, en yeni önce, akış halinde görünür."
        />
      )}

      {entries.length > 0 && (
        <ol className="mt-1">
          {entries.map((e, i) => (
            <TimelineNode key={e.request_id} entry={e} isLast={i === entries.length - 1} />
          ))}
        </ol>
      )}

      {q.hasNextPage && (
        <div className="flex justify-center pt-1">
          <Button variant="secondary" type="button" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            Daha fazla
          </Button>
        </div>
      )}
    </div>
  )
}
