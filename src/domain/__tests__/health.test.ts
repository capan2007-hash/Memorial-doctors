import { describe, it, expect } from 'vitest'
import { bmi, medicalValue, demographicsError } from '../health'

describe('bmi', () => {
  it('normal hesap (70kg, 175cm ≈ 22.9)', () => { expect(bmi(70, 175)).toBe(22.9) })
  it('geçersiz girdi null', () => {
    expect(bmi(0, 175)).toBeNull()
    expect(bmi(70, 0)).toBeNull()
    expect(bmi(-5, 175)).toBeNull()
  })
})

describe('medicalValue', () => {
  it('yok işaretliyse "Yok"', () => { expect(medicalValue(true, '')).toBe('Yok') })
  it('yok değilse metin döner', () => { expect(medicalValue(false, '  aspirin ')).toBe('aspirin') })
  it('yok değil ve boşsa null (geçersiz)', () => { expect(medicalValue(false, '   ')).toBeNull() })
})

describe('demographicsError', () => {
  it('geçerli değerlerde null', () => {
    expect(demographicsError(29, 62, 165)).toBeNull()
  })
  it('metre cinsinden boy yakalanır (1.65)', () => {
    const e = demographicsError(29, 62, 1.65)
    expect(e).toContain('santimetre')
  })
  it('boy aralık dışı (>250) hata', () => {
    expect(demographicsError(29, 62, 300)).not.toBeNull()
  })
  it('yaş aralık dışı hata', () => {
    expect(demographicsError(0, 62, 165)).not.toBeNull()
    expect(demographicsError(130, 62, 165)).not.toBeNull()
  })
  it('kilo aralık dışı hata', () => {
    expect(demographicsError(29, 0, 165)).not.toBeNull()
    expect(demographicsError(29, 600, 165)).not.toBeNull()
  })
  it('ondalık boy (172.5) geçerli — gönderimde yuvarlanır', () => {
    expect(demographicsError(29, 62, 172.5)).toBeNull()
  })
})
