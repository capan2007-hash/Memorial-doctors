import { describe, it, expect } from 'vitest'
import { resolveAssignees, type ScopedDoctor } from '../assignment'

const docs: ScopedDoctor[] = [
  // Saç Ekimi (alt-kırılımsız) doktoru
  { id: 'd1', isActive: true, scopes: [{ categoryId: 'sac', subcategoryId: null }] },
  { id: 'd2', isActive: false, scopes: [{ categoryId: 'sac', subcategoryId: null }] },
  // Plastik cerrah: meme + vücut + yüz yapar, burun YAPMAZ
  { id: 'd3', isActive: true, scopes: [
    { categoryId: 'plastik', subcategoryId: 'meme' },
    { categoryId: 'plastik', subcategoryId: 'vucut' },
    { categoryId: 'plastik', subcategoryId: 'yuz' },
  ] },
  // Sadece burun yapan doktor
  { id: 'd4', isActive: true, scopes: [{ categoryId: 'plastik', subcategoryId: 'burun' }] },
]

describe('resolveAssignees (scope)', () => {
  it('alt-kırılımsız kategoride null-eşleşen aktif doktorlar', () => {
    expect(resolveAssignees({ categoryId: 'sac', subcategoryId: null }, docs)).toEqual(['d1'])
  })
  it('pasif doktor atanmaz', () => {
    expect(resolveAssignees({ categoryId: 'sac', subcategoryId: null }, docs)).not.toContain('d2')
  })
  it('Meme talebi: meme yapan plastik cerraha düşer, buruncuya düşmez', () => {
    expect(resolveAssignees({ categoryId: 'plastik', subcategoryId: 'meme' }, docs).sort()).toEqual(['d3'])
  })
  it('Burun talebi: sadece burun yapan doktora düşer (d3 düşmez)', () => {
    expect(resolveAssignees({ categoryId: 'plastik', subcategoryId: 'burun' }, docs)).toEqual(['d4'])
  })
  it('Yüz talebi: d3 düşer', () => {
    expect(resolveAssignees({ categoryId: 'plastik', subcategoryId: 'yuz' }, docs)).toEqual(['d3'])
  })
  it('eşleşme yoksa boş', () => {
    expect(resolveAssignees({ categoryId: 'plastik', subcategoryId: 'genital' }, docs)).toEqual([])
  })
})
