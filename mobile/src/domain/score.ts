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

// Skor geçmişi (Faz 3b) — score_event kayıtlarından türetilen saf hesaplar.
export interface ScoreEventLite {
  delta: number
  created_at: string
}

export interface RangeNet {
  positive: number
  negative: number
  net: number
}

/** [fromIso, toIso] aralığındaki (dahil) olaylardan zamanında/geç sayıları ve net değişim. */
export function netChangeInRange(events: ScoreEventLite[], fromIso: string, toIso: string): RangeNet {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()
  let positive = 0
  let negative = 0
  for (const e of events) {
    const t = new Date(e.created_at).getTime()
    if (t < from || t > to) continue
    if (e.delta > 0) positive += 1
    else if (e.delta < 0) negative += 1
  }
  return { positive, negative, net: positive - negative }
}

const TR_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

export interface MonthlyNet {
  key: string
  label: string
  net: number
}

/** Son `monthsBack` ayın (bugün dahil, eskiden yeniye) net skor değişimi — boş aylar 0. */
export function monthlyNetChanges(events: ScoreEventLite[], now: Date = new Date(), monthsBack = 6): MonthlyNet[] {
  const buckets: MonthlyNet[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.push({ key, label: `${TR_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`, net: 0 })
  }
  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]))
  for (const e of events) {
    const d = new Date(e.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const idx = indexByKey.get(key)
    if (idx !== undefined) buckets[idx].net += e.delta
  }
  return buckets
}
