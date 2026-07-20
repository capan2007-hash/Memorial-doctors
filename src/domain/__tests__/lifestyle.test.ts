import { describe, it, expect } from 'vitest'
import { packYears, smokingStatusLabel, alcoholStatusLabel, lifestyleComplete } from '../lifestyle'

describe('lifestyle', () => {
  it('paket-yıl hesabı', () => {
    expect(packYears(20, 10)).toBe(10)
    expect(packYears(10, 5)).toBe(2.5)
    expect(packYears(null, 5)).toBeNull()
    expect(packYears(20, null)).toBeNull()
  })
  it('etiketler', () => {
    expect(smokingStatusLabel('current')).toBe('Aktif içici')
    expect(alcoholStatusLabel('regular')).toBe('Düzenli')
    expect(smokingStatusLabel('never')).toBe('Hiç kullanmadı')
  })
  it('tamlık: durum eksik', () => {
    expect(lifestyleComplete({ smokingStatus: '', smokingCigs: '', smokingYears: '', alcoholStatus: 'never', alcoholDrinks: '' })).toBe(false)
  })
  it('tamlık: aktif içici miktar eksik', () => {
    expect(lifestyleComplete({ smokingStatus: 'current', smokingCigs: '', smokingYears: '10', alcoholStatus: 'never', alcoholDrinks: '' })).toBe(false)
  })
  it('tamlık: düzenli alkol içki eksik', () => {
    expect(lifestyleComplete({ smokingStatus: 'never', smokingCigs: '', smokingYears: '', alcoholStatus: 'regular', alcoholDrinks: '' })).toBe(false)
  })
  it('tamlık: tam', () => {
    expect(lifestyleComplete({ smokingStatus: 'current', smokingCigs: '20', smokingYears: '10', alcoholStatus: 'regular', alcoholDrinks: '14' })).toBe(true)
    expect(lifestyleComplete({ smokingStatus: 'never', smokingCigs: '', smokingYears: '', alcoholStatus: 'never', alcoholDrinks: '' })).toBe(true)
  })
})
