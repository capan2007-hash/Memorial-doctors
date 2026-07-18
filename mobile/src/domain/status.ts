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

export const STATUS_COLORS: Record<RequestStatus, { bg: string; text: string }> = {
  draft: { bg: '#F1F5F9', text: '#475569' },
  submitted: { bg: '#F1F5F9', text: '#475569' },
  assigned: { bg: '#DBEAFE', text: '#1D4ED8' },
  in_review: { bg: '#E0E7FF', text: '#4338CA' },
  offers_ready: { bg: '#CCFBF1', text: '#115E59' },
  escalated: { bg: '#FEF3C7', text: '#B45309' },
  closed: { bg: '#E2E8F0', text: '#334155' },
}

// Doktor yanıt kararı (bkz. /src/types/domain.ts Decision) — kuyruk/geçmiş
// rozetleri ve talep detayı salt-okunur bloğu için Türkçe etiket + renk.
export type Decision = 'accept' | 'reject'

export const DECISION_LABELS: Record<Decision, string> = {
  accept: 'Kabul',
  reject: 'Red',
}

export const DECISION_COLORS: Record<Decision, { bg: string; text: string }> = {
  accept: { bg: '#CCFBF1', text: '#115E59' },
  reject: { bg: '#FEE2E2', text: '#B91C1C' },
}
