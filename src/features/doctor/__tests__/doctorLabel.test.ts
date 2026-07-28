import { describe, it, expect } from 'vitest'
import { doctorLabel } from '../doctorLabel'

describe('doctorLabel (çift unvan hatası regresyonu)', () => {
  it('normal durum: unvan + ad birleşir', () => {
    expect(doctorLabel('Doçent Doktor', 'Can İlker Demir')).toBe('Doçent Doktor Can İlker Demir')
  })
  it('KRİTİK: ad zaten unvanı içeriyorsa unvan TEKRARLANMAZ', () => {
    expect(doctorLabel('Op. Dr.', 'Op. Dr. Plastik')).toBe('Op. Dr. Plastik')
  })
  it('nokta/boşluk farkı önemsiz', () => {
    expect(doctorLabel('Op Dr', 'Op. Dr. Plastik')).toBe('Op. Dr. Plastik')
  })
  it('unvan adın içinde geçiyorsa tekrarlanmaz', () => {
    expect(doctorLabel('Dr. Mehmet', 'Op. Dr. Mehmet')).toBe('Op. Dr. Mehmet')
  })
  it('ad yoksa unvan döner', () => {
    expect(doctorLabel('Op. Dr.', null)).toBe('Op. Dr.')
  })
  it('unvan yoksa ad döner', () => {
    expect(doctorLabel(null, 'Ayşe Yılmaz')).toBe('Ayşe Yılmaz')
  })
  it('ikisi de yoksa boş', () => {
    expect(doctorLabel(null, null)).toBe('')
  })
})
