// Kaynak: /src/domain/duplicate.ts (web) — mobil mükerrer inceleme için birebir kopya
// (Metro repo-kökü dışı import kısıtı nedeniyle domain kopyalanır).
export type DupState = 'none' | 'pending' | 'confirmed' | 'dismissed'

const STATE_LABELS: Record<DupState, string> = {
  none: 'Normal',
  pending: 'İncelemede',
  confirmed: 'Mükerrer (pasif)',
  dismissed: 'Doktorlara gönderildi',
}
export function dupStateLabel(s: DupState): string {
  return STATE_LABELS[s]
}

export function dupConfidenceClass(conf: number | null, threshold: number): 'high' | 'low' | 'unknown' {
  if (conf == null) return 'unknown'
  return conf >= threshold ? 'high' : 'low'
}

export function formatConfidencePct(conf: number | null): string {
  if (conf == null) return '—'
  return `%${Math.round(conf * 100)}`
}

export function matchReasonLabel(r: 'phone' | 'name' | string): string {
  return r === 'phone' ? 'Telefon' : r === 'name' ? 'İsim' : r
}
