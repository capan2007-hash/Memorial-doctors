import { describe, it, expect } from 'vitest'
import { normalizePhone } from '../phone'

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
