import { dupConfidenceClass, dupStateLabel, formatConfidencePct, matchReasonLabel } from '../duplicate'

describe('dupConfidenceClass', () => {
  it('eşik üstü high, altı low, null unknown', () => {
    expect(dupConfidenceClass(0.8, 0.75)).toBe('high')
    expect(dupConfidenceClass(0.75, 0.75)).toBe('high')
    expect(dupConfidenceClass(0.5, 0.75)).toBe('low')
    expect(dupConfidenceClass(null, 0.75)).toBe('unknown')
  })
})

describe('formatConfidencePct', () => {
  it('yüzdeye çevirir', () => {
    expect(formatConfidencePct(0.83)).toBe('%83')
    expect(formatConfidencePct(1)).toBe('%100')
  })
  it('null → —', () => {
    expect(formatConfidencePct(null)).toBe('—')
  })
})

describe('dupStateLabel', () => {
  it('durum etiketleri', () => {
    expect(dupStateLabel('pending')).toBe('İncelemede')
    expect(dupStateLabel('confirmed')).toBe('Mükerrer (pasif)')
    expect(dupStateLabel('dismissed')).toBe('Doktorlara gönderildi')
  })
})

describe('matchReasonLabel', () => {
  it('telefon/isim', () => {
    expect(matchReasonLabel('phone')).toBe('Telefon')
    expect(matchReasonLabel('name')).toBe('İsim')
  })
})
