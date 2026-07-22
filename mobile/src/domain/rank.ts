// Doktor Panel sıralama yardımcıları. own_doctor_ranks RPC'sinden gelen sıra/toplam
// değerlerini görsel katmana (etiket + tier rengi) çevirir. Saf fonksiyonlar.
import type { Role } from '@/theme'

export type RankRole = Extract<Role, 'danger' | 'warning' | 'success'>

/** Kıyas için en az 2 doktor gerekir; altında yüzdelik/sıra anlamsızdır. */
export function comparable(total: number): boolean {
  return total >= 2
}

/** "üst %25" gibi bir etiket. pct null ise etiket üretilmez. */
export function topPercentLabel(pct: number | null): string | null {
  if (pct == null) return null
  return `üst %${pct}`
}

/** Üst ⅓ success, orta ⅓ warning, alt ⅓ danger. total<=0 ise warning (nötr). */
export function rankTier(rank: number, total: number): RankRole {
  if (total <= 0) return 'warning'
  const frac = rank / total
  if (frac <= 1 / 3) return 'success'
  if (frac <= 2 / 3) return 'warning'
  return 'danger'
}
