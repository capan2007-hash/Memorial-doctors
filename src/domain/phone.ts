/**
 * Telefon yardımcıları.
 *
 * TASARIM NOTU — `normalizePhone` neden hâlâ son 10 haneyi alıyor?
 * Veritabanındaki `normalize_phone` (0020_duplicate_detection.sql) de aynı
 * son-10 kuralında ve `patient_phone_norm_idx` fonksiyonel indeksi bunun
 * üzerine kurulu. Bu kural, ülke kodu OLMADAN kaydedilmiş eski satırlarla
 * (`5321112233`) E.164 olarak kaydedilen yeni satırların (`+905321112233`)
 * birbirini bulmasını sağlayan tek köprü — ülke kodu duyarlı bir normalize'a
 * geçilirse eski↔yeni eşleşmesi tamamen kırılır. Bu yüzden `normalizePhone`
 * DEĞİŞTİRİLMEMELİ; yalnız eşleştirme/karşılaştırma için kullanılır.
 * `patient.phone`'a yazılan değeri `toE164()` üretir.
 *
 * Mevcut satırlarda ülke kodu geri getirilemez; `+90` varsayan bir backfill
 * bilerek yapılmadı (yanlış ülke kodu, "bilinmiyor"dan daha kötüdür).
 *
 * Ayrıntı: docs/superpowers/specs/2026-07-28-telefon-e164-ulke-kodu-design.md
 */

/** Ülke kodu yazılmamış girdiler bu ülkenin numarası sayılır. */
const DEFAULT_COUNTRY = { dialCode: '90', nationalLength: 10 } as const

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

/**
 * Girdinin hangi biçimde yazıldığı. `explicit` = ülke kodu girdide belli
 * (rakamlar ülke kodu dahil), `national` = varsayılan ülke kodu eklenecek.
 */
type PhoneShape =
  | { kind: 'empty' }
  | { kind: 'explicit'; digits: string }
  | { kind: 'national'; national: string }

/**
 * Önek kurallarının TEK sahibi — `toE164`, `hasExplicitCountryCode` ve
 * `isValidPhone` üçü de buradan türer, böylece sıralama tek yerde yaşar.
 * Kurallar sırayla denenir; sıralama tasarımın parçasıdır.
 */
function classify(raw: string): PhoneShape {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return { kind: 'empty' }
  // 1) "+..." → ülke kodu açıkça verilmiş; rakamlara olduğu gibi güvenilir.
  if (trimmed.startsWith('+')) return { kind: 'explicit', digits }
  // 2) "00..." uluslararası çıkış öneki. Trunk "0" kuralından ÖNCE bakılmalı,
  //    yoksa "00966..." girdisi "+900966..." olurdu.
  if (digits.startsWith('00')) return { kind: 'explicit', digits: digits.slice(2) }
  // 3) Baştaki trunk "0" → ulusal biçim; "0" atılır.
  if (digits.startsWith('0')) return { kind: 'national', national: digits.slice(1) }
  // 4) Varsayılan ülke koduyla başlıyor VE ulusal uzunluktan uzunsa zaten
  //    uluslararası ("905321112233"). TR'de "90" ile başlayan alan kodu veya
  //    mobil öneki yok, bu yüzden kural yanlış tetiklenemez.
  if (
    digits.startsWith(DEFAULT_COUNTRY.dialCode) &&
    digits.length > DEFAULT_COUNTRY.nationalLength
  ) {
    return { kind: 'explicit', digits }
  }
  // 5) Ulusal biçim.
  return { kind: 'national', national: digits }
}

/**
 * Girdiyi kanonik E.164'e çevirir: `patient.phone`'a YAZILAN değer budur.
 * Rakam içermeyen girdide boş döner.
 */
export function toE164(raw: string): string {
  const shape = classify(raw)
  switch (shape.kind) {
    case 'empty':
      return ''
    case 'explicit':
      return `+${shape.digits}`
    case 'national':
      return `+${DEFAULT_COUNTRY.dialCode}${shape.national}`
  }
}

/**
 * Girdi ülke kodunu KENDİSİ belirliyor mu? Arayüzdeki "varsayıldı" uyarısı
 * ve `isValidPhone`'un doğrulama dalı buna bakar.
 */
export function hasExplicitCountryCode(raw: string): boolean {
  return classify(raw).kind === 'explicit'
}
