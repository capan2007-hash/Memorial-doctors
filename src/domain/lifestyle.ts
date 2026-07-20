export type SmokingStatus = 'never' | 'former' | 'current'
export type AlcoholStatus = 'never' | 'occasional' | 'regular'

export function packYears(cigsPerDay: number | null, years: number | null): number | null {
  if (cigsPerDay == null || years == null || !(cigsPerDay >= 0) || !(years >= 0)) return null
  return Math.round((cigsPerDay / 20) * years * 10) / 10
}

const SMOKING: Record<SmokingStatus, string> = { never: 'Hiç kullanmadı', former: 'Bıraktı', current: 'Aktif içici' }
const ALCOHOL: Record<AlcoholStatus, string> = { never: 'Hiç', occasional: 'Sosyal', regular: 'Düzenli' }
export function smokingStatusLabel(s: SmokingStatus): string { return SMOKING[s] }
export function alcoholStatusLabel(s: AlcoholStatus): string { return ALCOHOL[s] }

export interface LifestyleInput {
  smokingStatus: string; smokingCigs: string; smokingYears: string
  alcoholStatus: string; alcoholDrinks: string
}
export function lifestyleComplete(i: LifestyleInput): boolean {
  if (!i.smokingStatus || !i.alcoholStatus) return false
  if (i.smokingStatus === 'former' || i.smokingStatus === 'current') {
    if (!(Number(i.smokingCigs) > 0) || !(Number(i.smokingYears) > 0)) return false
  }
  if (i.alcoholStatus === 'regular') {
    if (!(Number(i.alcoholDrinks) > 0)) return false
  }
  return true
}
