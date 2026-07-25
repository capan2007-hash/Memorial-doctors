import { monthlyNetChanges, netChangeInRange, scoreTier } from '../score'
import { testT } from '@/test-utils/testT'

describe('scoreTier', () => {
  it('kelepçe eşikleri', () => {
    expect(scoreTier(5, testT).role).toBe('danger')
    expect(scoreTier(30, testT).role).toBe('warning')
    expect(scoreTier(70, testT).role).toBe('success')
  })
  it('< 10 için "Çalışılmaz" etiketi döner', () => {
    expect(scoreTier(5, testT).label).toBe('Çalışılmaz')
  })
})

describe('netChangeInRange', () => {
  const events = [
    { delta: 1, created_at: '2026-07-01T10:00:00Z' },
    { delta: 1, created_at: '2026-07-10T10:00:00Z' },
    { delta: -1, created_at: '2026-07-15T10:00:00Z' },
    { delta: 1, created_at: '2026-08-01T10:00:00Z' }, // aralık dışı
  ]
  it('aralık içi pozitif/negatif/net', () => {
    const r = netChangeInRange(events, '2026-07-01T00:00:00Z', '2026-07-31T23:59:59Z')
    expect(r.positive).toBe(2)
    expect(r.negative).toBe(1)
    expect(r.net).toBe(1)
  })
})

describe('monthlyNetChanges', () => {
  it('sabit genişlikte kovalar, boş aylar 0', () => {
    const now = new Date(2026, 6, 15) // Tem 2026
    const events = [
      { delta: 1, created_at: new Date(2026, 6, 2).toISOString() },
      { delta: 1, created_at: new Date(2026, 6, 5).toISOString() },
      { delta: -1, created_at: new Date(2026, 5, 20).toISOString() }, // Haz
    ]
    const buckets = monthlyNetChanges(events, testT, now, 6)
    expect(buckets).toHaveLength(6)
    expect(buckets[buckets.length - 1].net).toBe(2) // Tem
    expect(buckets[buckets.length - 2].net).toBe(-1) // Haz
    expect(buckets[0].net).toBe(0) // en eski ay boş
  })
})
