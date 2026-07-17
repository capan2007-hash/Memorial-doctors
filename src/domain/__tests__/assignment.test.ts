import { describe, it, expect } from 'vitest'
import { resolveAssignees, type AssignableDoctor } from '../assignment'

const docs: AssignableDoctor[] = [
  { id: 'd1', categoryId: 'sac', subcategoryId: null, isActive: true },
  { id: 'd2', categoryId: 'sac', subcategoryId: null, isActive: true },
  { id: 'd3', categoryId: 'sac', subcategoryId: null, isActive: false },
  { id: 'd4', categoryId: 'plastik', subcategoryId: 'burun', isActive: true },
  { id: 'd5', categoryId: 'plastik', subcategoryId: 'meme', isActive: true },
]

describe('resolveAssignees', () => {
  it('alt kırılımsız kategoride tüm aktif doktorlar', () => {
    expect(resolveAssignees({ categoryId: 'sac', subcategoryId: null }, docs).sort())
      .toEqual(['d1', 'd2'])
  })
  it('pasif doktor atanmaz', () => {
    expect(resolveAssignees({ categoryId: 'sac', subcategoryId: null }, docs))
      .not.toContain('d3')
  })
  it('alt kırılımlı kategoride yalnız o alt kırılımın doktorları', () => {
    expect(resolveAssignees({ categoryId: 'plastik', subcategoryId: 'burun' }, docs))
      .toEqual(['d4'])
  })
  it('eşleşme yoksa boş liste', () => {
    expect(resolveAssignees({ categoryId: 'dis', subcategoryId: null }, docs))
      .toEqual([])
  })
})
