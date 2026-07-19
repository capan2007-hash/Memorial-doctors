import { Link } from 'react-router-dom'
import { useMyRequests } from './useRequests'
import { StatusPill } from '../../components/ui/StatusPill'
import { Avatar } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { RoleGate } from '../../components/RoleGate'
import { timeAgo } from '../../lib/format'

export function RequestList() {
  const q = useMyRequests()
  return (
    <div>
      <PageHeader
        title="Talepler"
        actions={
          <RoleGate allow={['agent', 'sales']}>
            <Link to="/requests/new">
              <Button variant="primary">Yeni Talep</Button>
            </Link>
          </RoleGate>
        }
      />
      {q.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!q.isLoading && q.data?.length === 0 && (
        <EmptyState
          title="Henüz talep yok"
          description="İlk talebi oluşturmak için Yeni Talep'e tıklayın."
          action={
            <Link to="/requests/new">
              <Button variant="primary">Yeni Talep</Button>
            </Link>
          }
        />
      )}
      {!q.isLoading && q.data && q.data.length > 0 && (
        <ul className="mt-3 space-y-2">
          {q.data.map((r) => (
            <li key={r.id}>
              <Link
                to={`/requests/${r.id}`}
                className="flex items-center gap-3 rounded-card bg-surface-2 border border-line shadow-card p-3 transition ease-premium duration-[var(--dur-base)] hover:shadow-pop hover:-translate-y-px"
              >
                <Avatar name={r.patientName} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-primary truncate">{r.patientName}</p>
                  <p className="text-sm text-ink-muted truncate">{r.categoryName} · {timeAgo(r.created_at)}</p>
                </div>
                <StatusPill status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
