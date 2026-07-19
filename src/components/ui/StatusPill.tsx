import type { RequestStatus } from '../../types/domain'

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  assigned: 'Atandı',
  in_review: 'Yanıtlanıyor',
  offers_ready: 'Teklif hazır',
  escalated: 'Eskalasyon',
  closed: 'Kapandı',
}

const COLOR: Record<RequestStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-slate-100 text-slate-600',
  assigned: 'bg-blue-100 text-blue-700',
  in_review: 'bg-indigo-100 text-indigo-700',
  offers_ready: 'bg-brand-100 text-brand-700',
  escalated: 'bg-accent-100 text-accent-700',
  closed: 'bg-slate-200 text-slate-700',
}

export function StatusPill({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${COLOR[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
