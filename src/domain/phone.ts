/**
 * Telefon numarasını mükerrer-eşleştirme için normalize eder: rakam olmayan
 * her şeyi ("+", boşluk, tire, parantez…) atar, ardından +90/0 ülke/trunk
 * ön ekini soyup son 10 haneyi döner (ör. "+90 532 111 2233" → "5321112233").
 * 10 haneden kısa girdilerde soyulmuş rakamları olduğu gibi döner (girdi hâlâ
 * yazılıyor olabilir — erken uyarı vermemek için).
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}
