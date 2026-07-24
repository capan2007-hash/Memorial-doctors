import { useTranslation } from 'react-i18next'
import type { RequestStatus } from '../../types/domain'

/** Çip zemin/kenarlık/metin + öncü nokta rengi (semantik token'lar). */
const CHIP: Record<RequestStatus, string> = {
  offers_ready: 'bg-success-bg border border-success-border text-success-text',
  escalated: 'bg-danger-bg border border-danger-border text-danger-text',
  assigned: 'bg-info-bg border border-info-border text-info-text',
  in_review: 'bg-info-bg border border-info-border text-info-text',
  submitted: 'bg-surface-2 border border-line text-ink-muted',
  draft: 'bg-surface-2 border border-line text-ink-muted',
  closed: 'bg-surface-2 border border-line text-ink-secondary',
}

export function StatusPill({ status }: { status: RequestStatus }) {
  const { t } = useTranslation('common')
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${CHIP[status]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {t('status.' + status)}
    </span>
  )
}
