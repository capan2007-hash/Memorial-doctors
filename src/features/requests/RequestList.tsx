import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMyRequests } from './useRequests'
import { filterBySearch } from './searchRequests'
import { catalogName } from '../catalog/catalogName'
import { StatusPill } from '../../components/ui/StatusPill'
import { Avatar } from '../../components/ui/Avatar'
import { Skeleton } from '@/components/shadcn/skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { RoleGate } from '../../components/RoleGate'
import { timeAgo } from '../../lib/format'

export function RequestList() {
  const { t, i18n } = useTranslation('requests')
  const q = useMyRequests()
  const [search, setSearch] = useState('')
  const filtered = filterBySearch(q.data ?? [], search)
  return (
    <div>
      <PageHeader
        title={t('list.title')}
        actions={
          <RoleGate allow={['agent', 'sales']}>
            <Link to="/requests/new">
              <Button variant="primary">{t('list.newRequestButton')}</Button>
            </Link>
          </RoleGate>
        }
      />
      {q.isLoading && (
        <ul className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface-2 p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </li>
          ))}
        </ul>
      )}
      {!q.isLoading && q.data?.length === 0 && (
        <EmptyState
          title={t('list.emptyTitle')}
          description={t('list.emptyDescription')}
          action={
            <Link to="/requests/new">
              <Button variant="primary">{t('list.newRequestButton')}</Button>
            </Link>
          }
        />
      )}
      {!q.isLoading && q.data && q.data.length > 0 && (
        <>
          {/* Arama: ad/soyad/telefon — biriken kayıtlar içinde mükerrer kontrolü */}
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('list.searchPlaceholder')}
              aria-label={t('list.searchPlaceholder')}
              className="w-full rounded-control border border-line bg-surface-1 py-2 ps-9 pe-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-brand-fill focus:outline-none"
            />
          </div>
          {filtered.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/requests/${r.id}`}
                    className="flex items-center gap-3 rounded-card bg-surface-2 border border-line shadow-card p-3 transition ease-premium duration-[var(--dur-base)] hover:shadow-pop hover:-translate-y-px"
                  >
                    <Avatar name={r.patientName} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink-primary truncate">{r.patientName}</p>
                      <p className="text-sm text-ink-muted truncate">{r.category ? catalogName(r.category, i18n.language) : '—'} · {timeAgo(r.created_at)}</p>
                    </div>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-center text-sm text-ink-muted">{t('list.noSearchResults')}</p>
          )}
        </>
      )}
    </div>
  )
}
