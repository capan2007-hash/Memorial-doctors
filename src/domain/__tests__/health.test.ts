import { describe, it, expect } from 'vitest'
import { bmi, medicalValue } from '../health'

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
