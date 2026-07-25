import { comparable, rankTier, topPercentLabel } from '../rank'
import { testT } from '@/test-utils/testT'

describe('comparable', () => {
  it('en az 2 doktor gerekir', () => {
    expect(comparable(0)).toBe(false)
    expect(comparable(1)).toBe(false)
    expect(comparable(2)).toBe(true)
    expect(comparable(8)).toBe(true)
  })
})

describe('topPercentLabel', () => {
  it('yüzdelik etiketi üretir', () => {
    expect(topPercentLabel(25, testT)).toBe('üst %25')
    expect(topPercentLabel(100, testT)).toBe('üst %100')
  })
  it('null için etiket üretmez', () => {
    expect(topPercentLabel(null, testT)).toBeNull()
  })
})

describe('rankTier', () => {
  it('üst ⅓ success', () => {
    expect(rankTier(1, 8)).toBe('success')
    expect(rankTier(1, 4)).toBe('success')
  })
  it('orta ⅓ warning', () => {
    expect(rankTier(2, 4)).toBe('warning') // 0.5
    expect(rankTier(4, 8)).toBe('warning') // 0.5
  })
  it('alt ⅓ danger', () => {
    expect(rankTier(4, 4)).toBe('danger') // 1.0
    expect(rankTier(8, 8)).toBe('danger') // 1.0
  })
  it('total<=0 nötr warning', () => {
    expect(rankTier(1, 0)).toBe('warning')
  })
})
