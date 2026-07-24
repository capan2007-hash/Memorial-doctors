import { describe, it, expect } from 'vitest'
import { catalogName } from '../catalogName'

describe('catalogName', () => {
  it('name_i18n içinde lang varsa onu döner', () => {
    const row = { name: 'Burun Estetiği', name_i18n: { ar: 'تجميل الأنف', en: 'Rhinoplasty' } }
    expect(catalogName(row, 'ar')).toBe('تجميل الأنف')
    expect(catalogName(row, 'en')).toBe('Rhinoplasty')
  })

  it('name_i18n yoksa (null) name döner', () => {
    const row = { name: 'Burun Estetiği', name_i18n: null }
    expect(catalogName(row, 'ar')).toBe('Burun Estetiği')
  })

  it('name_i18n undefined ise name döner', () => {
    const row = { name: 'Burun Estetiği' }
    expect(catalogName(row, 'ar')).toBe('Burun Estetiği')
  })

  it('name_i18n var ama lang eksikse name döner', () => {
    const row = { name: 'Burun Estetiği', name_i18n: { en: 'Rhinoplasty' } }
    expect(catalogName(row, 'ar')).toBe('Burun Estetiği')
  })
})
