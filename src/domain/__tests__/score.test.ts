import { describe, it, expect } from 'vitest'
import { netChangeInRange, monthlyNetChanges } from '../score'

describe('netChangeInRange', () => {
  const events = [
    { delta: 1, created_at: '2026-06-01T00:00:00.000Z' },
    { delta: 1, created_at: '2026-06-15T00:00:00.000Z' },
    { delta: -1, created_at: '2026-06-20T00:00:00.000Z' },
    { delta: -1, created_at: '2026-05-01T00:00:00.000Z' }, // aralık dışı
  ]

  it('aralık içindeki olayları sayar, dışındakileri hariç tutar', () => {
    const r = netChangeInRange(events, '2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z')
    expect(r.positive).toBe(2)
    expect(r.negative).toBe(1)
    expect(r.net).toBe(1)
  })

  it('sınırlar dahildir', () => {
    const r = netChangeInRange(events, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')
    expect(r.positive).toBe(1)
    expect(r.negative).toBe(0)
  })

  it('boş olay listesi 0/0/0 döner', () => {
    const r = netChangeInRange([], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z')
    expect(r).toEqual({ positive: 0, negative: 0, net: 0 })
  })
})

describe('monthlyNetChanges', () => {
  const now = new Date('2026-07-19T12:00:00.000Z')

  it('son 6 ayı (Şub..Tem) eskiden yeniye sıralı, boş aylar 0 ile döner', () => {
    const buckets = monthlyNetChanges([], now, 6)
    expect(buckets.map((b) => b.key)).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'])
    expect(buckets.every((b) => b.net === 0)).toBe(true)
    expect(buckets[0].label).toBe('Şub 2026')
    expect(buckets[5].label).toBe('Tem 2026')
  })

  it('olayları doğru aya toplar', () => {
    const events = [
      { delta: 1, created_at: '2026-06-05T00:00:00.000Z' },
      { delta: 1, created_at: '2026-06-10T00:00:00.000Z' },
      { delta: -1, created_at: '2026-06-20T00:00:00.000Z' },
      { delta: -1, created_at: '2026-07-01T00:00:00.000Z' },
    ]
    const buckets = monthlyNetChanges(events, now, 6)
    const june = buckets.find((b) => b.key === '2026-06')!
    const july = buckets.find((b) => b.key === '2026-07')!
    expect(june.net).toBe(1)
    expect(july.net).toBe(-1)
  })

  it('aralık dışı yıl kaymasında (Ocak sınırı) doğru anahtar üretir', () => {
    const jan = new Date('2026-01-15T00:00:00.000Z')
    const buckets = monthlyNetChanges([], jan, 6)
    expect(buckets.map((b) => b.key)).toEqual(['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'])
  })
})
