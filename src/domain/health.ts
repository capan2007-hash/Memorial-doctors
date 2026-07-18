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

// Demografi aralık doğrulaması. Kök neden: kullanıcı boyu metre cinsinden
// (ör. 1.65) girebiliyor; DB'de height_cm integer olduğundan insert 400 alıyordu.
// Aralık dışıysa Türkçe hata mesajı döner; geçerliyse null.
export function demographicsError(age: number, weightKg: number, heightCm: number): string | null {
  if (!(age >= 1 && age <= 120)) return 'Yaş 1-120 aralığında olmalı.'
  if (!(weightKg >= 1 && weightKg <= 500)) return 'Kilo 1-500 kg aralığında olmalı.'
  if (!(heightCm >= 50 && heightCm <= 250)) {
    return 'Boy santimetre cinsinden girilmeli (ör. 165). Geçerli aralık: 50-250 cm.'
  }
  return null
}
