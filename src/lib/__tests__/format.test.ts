import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import i18n from '../../i18n'
import { timeAgo, formatMins } from '../format'

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()))
  }
  await i18n.changeLanguage('tr')
})

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

describe('timeAgo / formatMins — dil duyarlılığı (EN)', () => {
  const at = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString()

  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  afterAll(async () => {
    await i18n.changeLanguage('tr')
  })

  it('just now (< 60s)', () => {
    expect(timeAgo(at(30 * 1000), NOW)).toBe('just now')
  })

  it('N min ago (< 60min)', () => {
    expect(timeAgo(at(5 * 60_000), NOW)).toBe('5 min ago')
  })

  it('N hr ago (< 24hr)', () => {
    expect(timeAgo(at(2 * 3_600_000), NOW)).toBe('2 hr ago')
  })

  it('N days ago (< 7days)', () => {
    expect(timeAgo(at(3 * 86_400_000), NOW)).toBe('3 days ago')
  })

  it('formatMins: < 60 → "N min"', () => {
    expect(formatMins(45)).toBe('45 min')
  })

  it('formatMins: >= 60 → "H hr M min"', () => {
    expect(formatMins(125)).toBe('2 hr 5 min')
  })
})

describe('timeAgo / formatMins — dil duyarlılığı (AR)', () => {
  const at = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString()

  beforeAll(async () => {
    await i18n.changeLanguage('ar')
  })

  afterAll(async () => {
    await i18n.changeLanguage('tr')
  })

  it('الآن (< 60s)', () => {
    expect(timeAgo(at(30 * 1000), NOW)).toBe('الآن')
  })

  it('قبل N دقيقة (< 60min)', () => {
    expect(timeAgo(at(5 * 60_000), NOW)).toBe('قبل 5 دقيقة')
  })

  it('قبل N ساعة (< 24hr)', () => {
    expect(timeAgo(at(2 * 3_600_000), NOW)).toBe('قبل 2 ساعة')
  })

  it('قبل N أيام (< 7days)', () => {
    expect(timeAgo(at(3 * 86_400_000), NOW)).toBe('قبل 3 أيام')
  })

  it('formatMins: < 60 → "N د"', () => {
    expect(formatMins(45)).toBe('45 د')
  })

  it('formatMins: >= 60 → "H س M د"', () => {
    expect(formatMins(125)).toBe('2 س 5 د')
  })
})
