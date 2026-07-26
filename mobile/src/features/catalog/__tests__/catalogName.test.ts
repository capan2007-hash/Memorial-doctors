import { catalogName } from '../catalogName'

describe('catalogName', () => {
  it('name_i18n içinde dil varsa çevrilmiş adı döner', () => {
    const row = { name: 'Boy Uzatma', name_i18n: { de: 'Beinverlängerung', en: 'Limb Lengthening' } }
    expect(catalogName(row, 'de')).toBe('Beinverlängerung')
    expect(catalogName(row, 'en')).toBe('Limb Lengthening')
  })

  it('name_i18n içinde dil yoksa row.name (Türkçe) köküne düşer', () => {
    const row = { name: 'Boy Uzatma', name_i18n: { de: 'Beinverlängerung' } }
    expect(catalogName(row, 'fr')).toBe('Boy Uzatma')
  })

  it('name_i18n null/undefined ise row.name döner', () => {
    expect(catalogName({ name: 'Plastik Cerrahi', name_i18n: null }, 'de')).toBe('Plastik Cerrahi')
    expect(catalogName({ name: 'Plastik Cerrahi' }, 'de')).toBe('Plastik Cerrahi')
  })
})
