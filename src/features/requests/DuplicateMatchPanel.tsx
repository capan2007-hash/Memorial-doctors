import type { RequestStatus } from '../../types/domain'
import { STATUS_LABELS } from '../../components/ui/StatusPill'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { AlertTriangle } from 'lucide-react'
import { formatDate } from '../../lib/format'

/** `find_patient_matches` RPC'sinin döndürdüğü aday hasta satırı (bkz. migration 0020). */
export interface MatchRow {
  patient_id: string
  first_name: string
  last_name: string
  phone: string | null
  request_count: number
  last_request_at: string | null
  last_status: RequestStatus | null
  has_open_request: boolean
  has_available_photos: boolean
  had_deleted_photos: boolean
  match_reason: 'phone' | 'name'
}

function photoStatusText(m: MatchRow): string {
  if (m.has_available_photos) return 'fotoğraflar mevcut'
  if (m.had_deleted_photos) return 'önceki fotoğraflar silinmiş'
  return 'fotoğraf yok'
}

export function DuplicateMatchPanel({
  matches,
  onSelectSame,
  onDismiss,
}: {
  matches: MatchRow[]
  onSelectSame: (m: MatchRow) => void
  onDismiss: () => void
}) {
  if (matches.length === 0) return null

  return (
    <Card className="border-warning-border bg-warning-bg">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 font-display text-sm text-warning-text">
            <Icon of={AlertTriangle} size={15} />
            Bu bilgilerle {matches.length} olası eşleşme
          </h4>
          <Button variant="ghost" onClick={onDismiss}>Farklı kişi (yeni kayıt)</Button>
        </div>

        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.patient_id} className="flex flex-col gap-2 rounded-control border border-line bg-surface-1 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink-primary">{m.first_name} {m.last_name}</span>
                  {m.phone && <span className="text-ink-muted tnum">{m.phone}</span>}
                  {m.has_open_request && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text">
                      <Icon of={AlertTriangle} size={12} />
                      Açık talep var
                    </span>
                  )}
                </div>
                <p className="text-ink-muted">
                  <span className="tnum">{m.request_count}</span> başvuru
                  {m.last_status && (
                    <>
                      {' · '}Son: {STATUS_LABELS[m.last_status]}
                      {m.last_request_at && <> · <span className="tnum">{formatDate(m.last_request_at)}</span></>}
                    </>
                  )}
                  {' · '}{photoStatusText(m)}
                </p>
              </div>
              <Button variant="secondary" onClick={() => onSelectSame(m)}>Aynı hasta</Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
