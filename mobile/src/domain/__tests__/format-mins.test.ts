import { formatMins } from '../format'
import { testT } from '@/test-utils/testT'

describe('formatMins', () => {
  it('< 60 dk → "{n} dk"', () => {
    expect(formatMins(0, testT)).toBe('0 dk')
    expect(formatMins(45, testT)).toBe('45 dk')
    expect(formatMins(59, testT)).toBe('59 dk')
  })

  it('yuvarlar', () => {
    expect(formatMins(44.4, testT)).toBe('44 dk')
    expect(formatMins(59.6, testT)).toBe('1 sa 0 dk')
  })

  it('>= 60 dk → "{h} sa {m} dk"', () => {
    expect(formatMins(60, testT)).toBe('1 sa 0 dk')
    expect(formatMins(90, testT)).toBe('1 sa 30 dk')
    expect(formatMins(125, testT)).toBe('2 sa 5 dk')
  })
})
