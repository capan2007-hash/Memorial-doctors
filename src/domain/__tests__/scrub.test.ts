import { describe, it, expect } from 'vitest'
import { scrubPii } from '../../../supabase/functions/ai-triage/scrub'

describe('scrubPii', () => {
  it('TC kimlik numarasını (11 ardışık hane) maskeler', () => {
    expect(scrubPii('TC: 12345678901 kayıtlı')).toBe('TC: [maskelendi] kayıtlı')
  })

  it('+90 ile başlayan telefon numarasını maskeler', () => {
    expect(scrubPii('Ara: +905551234567')).toBe('Ara: [maskelendi]')
  })

  it('0 ile başlayan ayraçlı telefon numarasını maskeler', () => {
    expect(scrubPii('Numara: 0555 123 45 67')).toBe('Numara: [maskelendi]')
  })

  it('tire ayraçlı telefon numarasını maskeler', () => {
    expect(scrubPii('Numara: 0555-123-45-67')).toBe('Numara: [maskelendi]')
  })

  it('e-posta adresini maskeler', () => {
    expect(scrubPii('İletişim: ayse.yilmaz@example.com lütfen')).toBe('İletişim: [maskelendi] lütfen')
  })

  it('TR IBAN numarasını maskeler', () => {
    expect(scrubPii('IBAN: TR330006100519786457841326')).toBe('IBAN: [maskelendi]')
  })

  it('ayraçlı TR IBAN numarasını maskeler', () => {
    expect(scrubPii('IBAN: TR33 0006 1005 1978 6457 8413 26')).toBe('IBAN: [maskelendi]')
  })

  it('birden fazla PII örneğini aynı metinde maskeler', () => {
    const input = 'Hasta TC 12345678901, tel +905551234567, mail a@b.com'
    const out = scrubPii(input)
    expect(out).toBe('Hasta TC [maskelendi], tel [maskelendi], mail [maskelendi]')
  })

  it('yaş (35) gibi sıradan kısa sayıları maskelemez', () => {
    expect(scrubPii('Yaş: 35')).toBe('Yaş: 35')
  })

  it('boy (175) gibi sıradan kısa sayıları maskelemez', () => {
    expect(scrubPii('Boy: 175 cm')).toBe('Boy: 175 cm')
  })

  it('yıl (2019) gibi sıradan kısa sayıları maskelemez', () => {
    expect(scrubPii('2019 yılında ameliyat oldu')).toBe('2019 yılında ameliyat oldu')
  })

  it('"3000 greft" gibi işlem detaylarını maskelemez', () => {
    expect(scrubPii('3000 greft planlandı')).toBe('3000 greft planlandı')
  })

  it('PII içermeyen metni değiştirmeden döner', () => {
    const text = 'Sigara kullanmıyor, alerji yok'
    expect(scrubPii(text)).toBe(text)
  })

  it('null/undefined benzeri boş girişte hata fırlatmaz', () => {
    expect(scrubPii('')).toBe('')
  })

  it('harfe bitişik TC kimlik numarasını maskeler', () => {
    expect(scrubPii('TC12345678901 kayıtlı')).toBe('TC[maskelendi] kayıtlı')
  })

  it('öneksiz 5xx cep numarasını maskeler', () => {
    expect(scrubPii('Tel: 5551234567')).toBe('Tel: [maskelendi]')
  })

  it('parantezli cep numarasını maskeler', () => {
    expect(scrubPii('Tel: 0(555) 123 45 67')).toBe('Tel: [maskelendi]')
  })

  it('Türkçe karakterli e-postayı TAMAMEN maskeler (ad sızmaz)', () => {
    const out = scrubPii('İletişim: ayşe.yılmaz@example.com')
    expect(out).toBe('İletişim: [maskelendi]')
    expect(out).not.toContain('ayş')
  })
})
