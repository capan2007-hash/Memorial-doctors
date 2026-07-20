// Kaynak: /src/components/ui/StatusPill.tsx (web) — durum → Türkçe etiket + renk eşlemesi.
// Metro repo-kökü dışı import kısıtı nedeniyle kopyalandı; renkler tema tokenlarına (src/theme.ts) uyarlandı.
export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'assigned'
  | 'in_review'
  | 'offers_ready'
  | 'escalated'
  | 'closed'

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  assigned: 'Atandı',
  in_review: 'Yanıtlanıyor',
  offers_ready: 'Teklif hazır',
  escalated: 'Eskalasyon',
  closed: 'Kapandı',
}

import type { Role } from '@/theme'

// Durum → semantik rol (renk temadan çözülür — roleColors). state-dot çipleri için.
export const STATUS_ROLE: Record<RequestStatus, Role> = {
  draft: 'neutral',
  submitted: 'neutral',
  assigned: 'info',
  in_review: 'info',
  offers_ready: 'success',
  escalated: 'danger',
  closed: 'neutral',
}

// Doktor yanıt kararı (bkz. /src/types/domain.ts Decision) — kuyruk/geçmiş
// rozetleri ve talep detayı salt-okunur bloğu için Türkçe etiket + renk.
export type Decision = 'accept' | 'reject'

export const DECISION_LABELS: Record<Decision, string> = {
  accept: 'Kabul',
  reject: 'Red',
}

export const DECISION_ROLE: Record<Decision, Role> = {
  accept: 'success',
  reject: 'danger',
}
