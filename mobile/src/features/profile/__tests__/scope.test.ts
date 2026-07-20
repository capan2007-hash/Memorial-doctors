import { hasScope, toggleScope } from '../scope'
import { scoreTier } from '@/domain/score'
import type { DoctorScope } from '../scope'

const base: DoctorScope[] = [
  { categoryId: 'c1', subcategoryId: null },
  { categoryId: 'c2', subcategoryId: 's1' },
]

describe('hasScope', () => {
  it('kategori (alt kırılımsız) eşleşir', () => {
    expect(hasScope(base, 'c1', null)).toBe(true)
    expect(hasScope(base, 'c1', 's1')).toBe(false)
  })
  it('kategori + alt kırılım eşleşir', () => {
    expect(hasScope(base, 'c2', 's1')).toBe(true)
    expect(hasScope(base, 'c2', 's2')).toBe(false)
  })
})

describe('toggleScope', () => {
  it('yoksa ekler', () => {
    const next = toggleScope(base, { categoryId: 'c3', subcategoryId: null })
    expect(next).toHaveLength(3)
    expect(hasScope(next, 'c3', null)).toBe(true)
  })
  it('varsa çıkarır', () => {
    const next = toggleScope(base, { categoryId: 'c1', subcategoryId: null })
    expect(next).toHaveLength(1)
    expect(hasScope(next, 'c1', null)).toBe(false)
  })
  it('immutable — orijinali değiştirmez', () => {
    toggleScope(base, { categoryId: 'c1', subcategoryId: null })
    expect(base).toHaveLength(2)
  })
})

describe('scoreTier', () => {
  it('< 10 danger + "Çalışılmaz"', () => {
    expect(scoreTier(0)).toEqual({ role: 'danger', label: 'Çalışılmaz' })
    expect(scoreTier(9)).toEqual({ role: 'danger', label: 'Çalışılmaz' })
  })
  it('10-49 warning', () => {
    expect(scoreTier(10)).toEqual({ role: 'warning' })
    expect(scoreTier(49)).toEqual({ role: 'warning' })
  })
  it('>= 50 success', () => {
    expect(scoreTier(50)).toEqual({ role: 'success' })
    expect(scoreTier(100)).toEqual({ role: 'success' })
  })
})
