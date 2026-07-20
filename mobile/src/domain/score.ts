// Kaynak: /src/domain/score.ts scoreTier (web) — BRD §6.2 kelepçe eşikleri mobil
// palet rollerine (roleColors) eşlenir; Tailwind sınıfları yerine semantik Role döner.
import type { Role } from '@/theme'

export interface ScoreTier {
  role: Extract<Role, 'danger' | 'warning' | 'success'>
  label?: string
}

/** <10 "Çalışılmaz" (danger), 10-49 uyarı (warning), >=50 iyi (success). */
export function scoreTier(score: number): ScoreTier {
  if (score < 10) return { role: 'danger', label: 'Çalışılmaz' }
  if (score < 50) return { role: 'warning' }
  return { role: 'success' }
}
