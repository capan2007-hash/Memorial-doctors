export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

export function medicalValue(none: boolean, text: string): string | null {
  if (none) return 'Yok'
  const t = text.trim()
  return t.length ? t : null
}
