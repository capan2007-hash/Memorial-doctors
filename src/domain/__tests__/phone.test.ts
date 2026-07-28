import { describe, it, expect } from 'vitest'
import { normalizePhone, toE164, hasExplicitCountryCode, isValidPhone } from '../phone'

describe('normalizePhone', () => {
  it('+90 ile başlayan ve boşluklu girdiyi 10 haneye indirger', () => {
    expect(normalizePhone('+90 532 111 2233')).toBe('5321112233')
  })

  it('0 ile başlayan ve tire içeren girdiyi 10 haneye indirger', () => {
    expect(normalizePhone('0532-111-22-33')).toBe('5321112233')
  })

  it('90 ile başlayan (artı işaretsiz) girdiyi 10 haneye indirger', () => {
    expect(normalizePhone('905321112233')).toBe('5321112233')
  })

  it('zaten 10 haneli çıplak girdiyi değiştirmeden döner', () => {
    expect(normalizePhone('5321112233')).toBe('5321112233')
  })

  it('parantez ve boşluk gibi biçimlendirmeleri temizler', () => {
    expect(normalizePhone('(0532) 111 22 33')).toBe('5321112233')
  })

  it('10 haneden kısa girdiyi olduğu gibi (soyulmuş) döner', () => {
    expect(normalizePhone('532111')).toBe('532111')
  })

  it('boş girdi için boş döner', () => {
    expect(normalizePhone('')).toBe('')
  })

  it('yalnız rakam olmayan karakterlerden oluşan girdi için boş döner', () => {
    expect(normalizePhone('abc-def')).toBe('')
  })
})

describe('toE164', () => {
  it('artı işaretli uluslararası girdiyi biçimlendirmeden arındırır', () => {
    expect(toE164('+966 51 234 5678')).toBe('+966512345678')
  })

  it('00 uluslararası çıkış önekini + karşılığına çevirir', () => {
    expect(toE164('00966512345678')).toBe('+966512345678')
  })

  it('00 kuralı trunk 0 kuralından önce gelir', () => {
    // "00 90 ..." trunk-0 dalına düşerse "+900905..." üretilirdi.
    expect(toE164('00 90 532 111 22 33')).toBe('+905321112233')
  })

  it('baştaki trunk 0 yerine varsayılan ülke kodunu koyar', () => {
    expect(toE164('0532 111 22 33')).toBe('+905321112233')
  })

  it('artısız ama varsayılan ülke koduyla başlayan uzun girdiyi uluslararası sayar', () => {
    expect(toE164('905321112233')).toBe('+905321112233')
  })

  it('çıplak ulusal numaraya varsayılan ülke kodunu ekler', () => {
    expect(toE164('532 111 22 33')).toBe('+905321112233')
  })

  it('parantezli ulusal girdiyi de çevirir', () => {
    expect(toE164('(0532) 111 22 33')).toBe('+905321112233')
  })

  it('Rus numarasını ülke koduyla korur', () => {
    expect(toE164('+7 912 345 67 89')).toBe('+79123456789')
  })

  it('rakam içermeyen girdi için boş döner', () => {
    expect(toE164('abc-def')).toBe('')
  })

  it('boş girdi için boş döner', () => {
    expect(toE164('')).toBe('')
  })

  it('yalnız boşluktan oluşan girdi için boş döner', () => {
    expect(toE164('   ')).toBe('')
  })
})

describe('hasExplicitCountryCode', () => {
  it('artı işaretli girdi için true döner', () => {
    expect(hasExplicitCountryCode('+966512345678')).toBe(true)
  })

  it('00 önekli girdi için true döner', () => {
    expect(hasExplicitCountryCode('00966512345678')).toBe(true)
  })

  it('artısız ama varsayılan ülke koduyla başlayan uzun girdi için true döner', () => {
    // Doğru sonuca ulaşıyor; arayüzde "varsayıldı" uyarısı GÖSTERİLMEMELİ.
    expect(hasExplicitCountryCode('905321112233')).toBe(true)
  })

  it('çıplak ulusal numara için false döner', () => {
    expect(hasExplicitCountryCode('5321112233')).toBe(false)
  })

  it('trunk 0 ile başlayan ulusal numara için false döner', () => {
    expect(hasExplicitCountryCode('0532 111 22 33')).toBe(false)
  })

  it('boş girdi için false döner', () => {
    expect(hasExplicitCountryCode('')).toBe(false)
  })
})

describe('isValidPhone', () => {
  it('10 haneli TR ulusal numarayı kabul eder', () => {
    expect(isValidPhone('5321112233')).toBe(true)
  })

  it('trunk 0 ile yazılmış TR numarasını kabul eder', () => {
    expect(isValidPhone('0532 111 22 33')).toBe(true)
  })

  it('ülke kodu varsayıldığında eksik haneli girdiyi eler', () => {
    // toE164 başa "90" eklediği için toplam 10 haneye çıkar; tek bir
    // "en az 10 hane" kuralı bu girdiyi yanlışlıkla geçerli sayardı.
    expect(isValidPhone('12345678')).toBe(false)
  })

  it('kısa girdiyi eler', () => {
    expect(isValidPhone('532111')).toBe(false)
  })

  it('ülke kodu açık verilmiş kısa ulusal numaralı ülkeyi kabul eder', () => {
    expect(isValidPhone('+45 12345678')).toBe(true)
  })

  it('Suudi numarasını kabul eder', () => {
    expect(isValidPhone('+966 51 234 5678')).toBe(true)
  })

  it('artısız ama ülke kodlu uzun girdiyi kabul eder', () => {
    expect(isValidPhone('905321112233')).toBe(true)
  })

  it('E.164 üst sınırını (15 hane) aşan girdiyi eler', () => {
    expect(isValidPhone('+1234567890123456')).toBe(false)
  })

  it('boş girdiyi eler', () => {
    expect(isValidPhone('')).toBe(false)
  })
})

describe('toE164 ↔ normalizePhone uyumu (mükerrer eşleştirme regresyonu)', () => {
  // KİLİT VARSAYIM: E.164'e geçiş, DB'deki normalize_phone (son 10 hane)
  // eşleştirmesini bozmamalı. toE164 yalnız başa ekleme yaptığı için 10+
  // haneli her girdide son 10 hane aynı kalır. Bu test o varsayımı sabitler;
  // kırılırsa eski kayıtlar yeni kayıtlarla eşleşmiyor demektir.
  const inputs = [
    '+90 532 111 2233',
    '0532-111-22-33',
    '905321112233',
    '5321112233',
    '(0532) 111 22 33',
    '+966 51 234 5678',
    '00966512345678',
  ]

  it.each(inputs)('normalize sonucu %s için değişmez', (input) => {
    expect(normalizePhone(toE164(input))).toBe(normalizePhone(input))
  })
})
