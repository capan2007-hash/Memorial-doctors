import { describe, it, expect } from 'vitest'
import { RETENTION } from '../retention'
import { isIdentityComplete, type ClinicIdentity } from '../clinicIdentity'

const FULL: ClinicIdentity = {
  legalName: 'Örnek Sağlık Hizmetleri A.Ş.',
  address: 'Örnek Mah. Örnek Cad. No:1, İstanbul',
  email: 'kvkk@ornek.com',
  phone: '',
  verbis: '',
}

describe('RETENTION', () => {
  it('tenant varsayılanlarıyla eşleşir (0016_photo_lifecycle.sql)', () => {
    // Bu test kırıldıysa: tenant.photo_retention_days / photo_op_buffer_days
    // değişmiş olabilir. Sabiti güncellemekle YETMEZ — aydınlatma metnindeki
    // saklama süresi cümlesi de gözden geçirilmeli.
    expect(RETENTION.photoDays).toBe(60)
    expect(RETENTION.opBufferDays).toBe(30)
  })
})

describe('isIdentityComplete', () => {
  it('zorunlu üç alan doluysa true (telefon/VERBİS opsiyonel)', () => {
    expect(isIdentityComplete(FULL)).toBe(true)
  })

  it('unvan boşsa false', () => {
    expect(isIdentityComplete({ ...FULL, legalName: '' })).toBe(false)
  })

  it('adres boşsa false', () => {
    expect(isIdentityComplete({ ...FULL, address: '' })).toBe(false)
  })

  it('e-posta boşsa false', () => {
    expect(isIdentityComplete({ ...FULL, email: '' })).toBe(false)
  })

  it('yalnız boşluk karakteri dolu sayılmaz', () => {
    expect(isIdentityComplete({ ...FULL, address: '   ' })).toBe(false)
  })

  it('üç alan da boşsa false (üretimdeki başlangıç durumu)', () => {
    expect(isIdentityComplete({ legalName: '', address: '', email: '', phone: '', verbis: '' })).toBe(false)
  })
})
