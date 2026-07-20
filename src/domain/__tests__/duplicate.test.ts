import { describe, it, expect } from 'vitest'
import { dupStateLabel, dupConfidenceClass, formatConfidencePct, matchReasonLabel } from '../duplicate'

describe('duplicate domain', () => {
  it('dup_state Türkçe etiketleri', () => {
    expect(dupStateLabel('pending')).toBe('İncelemede')
    expect(dupStateLabel('confirmed')).toBe('Mükerrer (pasif)')
    expect(dupStateLabel('dismissed')).toBe('Doktorlara gönderildi')
  })
  it('güven eşiği sınıfı', () => {
    expect(dupConfidenceClass(0.9, 0.75)).toBe('high')
    expect(dupConfidenceClass(0.5, 0.75)).toBe('low')
    expect(dupConfidenceClass(null, 0.75)).toBe('unknown')
  })
  it('güven yüzdesi biçimi', () => {
    expect(formatConfidencePct(0.87)).toBe('%87')
    expect(formatConfidencePct(null)).toBe('—')
  })
  it('eşleşme sebebi etiketi', () => {
    expect(matchReasonLabel('phone')).toBe('Telefon')
    expect(matchReasonLabel('name')).toBe('İsim')
  })
})
