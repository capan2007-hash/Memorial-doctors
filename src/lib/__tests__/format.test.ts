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
