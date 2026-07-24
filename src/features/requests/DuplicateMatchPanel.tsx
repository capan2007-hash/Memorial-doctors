import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { RequestStatus } from '../../types/domain'
import { StatusPill } from '../../components/ui/StatusPill'
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

function photoStatusText(m: MatchRow, t: TFunction): string {
  if (m.has_available_photos) return t('duplicatePanel.photoStatusAvailable')
  if (m.had_deleted_photos) return t('duplicatePanel.photoStatusDeleted')
  return t('duplicatePanel.photoStatusNone')
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
  const { t } = useTranslation('requests')
  if (matches.length === 0) return null

  return (
    <Card className="border-warning-border bg-warning-bg">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 font-display text-sm text-warning-text">
            <Icon of={AlertTriangle} size={15} />
            {t('duplicatePanel.matchCount', { count: matches.length })}
          </h4>
          <Button variant="ghost" onClick={onDismiss}>{t('duplicatePanel.differentPerson')}</Button>
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
                      {t('duplicatePanel.hasOpenRequest')}
                    </span>
                  )}
                </div>
                <p className="text-ink-muted">
                  <span className="tnum">{m.request_count}</span> {t('duplicatePanel.requestCountLabel', { count: m.request_count })}
                  {m.last_status && (
                    <>
                      {' · '}{t('duplicatePanel.lastLabel')} <StatusPill status={m.last_status} />
                      {m.last_request_at && <> · <span className="tnum">{formatDate(m.last_request_at)}</span></>}
                    </>
                  )}
                  {' · '}{photoStatusText(m, t)}
                </p>
              </div>
              <Button variant="secondary" onClick={() => onSelectSame(m)}>{t('duplicatePanel.samePatient')}</Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
