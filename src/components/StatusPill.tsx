import type { RequestStatus } from '../types/domain'
const LABEL: Record<RequestStatus, string> = {
  draft: 'Taslak', submitted: 'Gönderildi', assigned: 'Atandı', in_review: 'Yanıtlanıyor',
  offers_ready: 'Teklif hazır', escalated: 'Eskalasyon', closed: 'Kapandı',
}
export function StatusPill({ status }: { status: RequestStatus }) {
  return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200">{LABEL[status]}</span>
}
