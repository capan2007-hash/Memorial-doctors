import { describe, it, expect } from 'vitest'
import { timeAgo } from '../format'

const NOW = new Date('2026-07-18T12:00:00.000Z')

describe('timeAgo', () => {
  it('az önce (< 60sn)', () => {
    const iso = new Date(NOW.getTime() - 30 * 1000).toISOString()
    expect(timeAgo(iso, NOW)).toBe('az önce')
  })

  it('N dk önce (< 60dk)', () => {
    const iso = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString()
    expect(timeAgo(iso, NOW)).toBe('5 dk önce')
  })

  it('N sa önce (< 24sa)', () => {
    const iso = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString()
    expect(timeAgo(iso, NOW)).toBe('2 sa önce')
  })

  it('N gün önce (< 7gün)', () => {
    const iso = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(timeAgo(iso, NOW)).toBe('3 gün önce')
  })

  it('eski tarih için DD.MM.YYYY formatı', () => {
    const iso = new Date('2026-01-05T08:00:00.000Z').toISOString()
    expect(timeAgo(iso, NOW)).toBe('05.01.2026')
  })

  it('geçersiz tarih için boş string döner', () => {
    expect(timeAgo('not-a-date', NOW)).toBe('')
  })
})

describe('timeAgo sınır durumları', () => {
  const NOW = new Date('2026-07-18T12:00:00Z')
  const at = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString()
  it('59 sn → az önce', () => { expect(timeAgo(at(59_000), NOW)).toBe('az önce') })
  it('59 dk → dk önce', () => { expect(timeAgo(at(59 * 60_000), NOW)).toBe('59 dk önce') })
  it('23 sa → sa önce', () => { expect(timeAgo(at(23 * 3_600_000), NOW)).toBe('23 sa önce') })
  it('6 gün → gün önce', () => { expect(timeAgo(at(6 * 86_400_000), NOW)).toBe('6 gün önce') })
  it('7 gün → tarih formatı', () => { expect(timeAgo(at(7 * 86_400_000), NOW)).toBe('11.07.2026') })
})
