import { formatMins } from '../format'

describe('formatMins', () => {
  it('< 60 dk → "{n} dk"', () => {
    expect(formatMins(0)).toBe('0 dk')
    expect(formatMins(45)).toBe('45 dk')
    expect(formatMins(59)).toBe('59 dk')
  })

  it('yuvarlar', () => {
    expect(formatMins(44.4)).toBe('44 dk')
    expect(formatMins(59.6)).toBe('1 sa 0 dk')
  })

  it('>= 60 dk → "{h} sa {m} dk"', () => {
    expect(formatMins(60)).toBe('1 sa 0 dk')
    expect(formatMins(90)).toBe('1 sa 30 dk')
    expect(formatMins(125)).toBe('2 sa 5 dk')
  })
})
