import { describe, it, expect } from 'vitest'
import { countUnseenResponses } from '../unseen'

const T1 = '2026-07-27T10:00:00.000Z'
const T2 = '2026-07-27T12:00:00.000Z'

describe('countUnseenResponses', () => {
  it('yanıtı olmayan talep sayılmaz', () => {
    expect(countUnseenResponses([{ id: 'a', sales_seen_at: null }], [])).toBe(0)
  })

  it('yanıt var + hiç bakılmamış → sayılır', () => {
    const n = countUnseenResponses(
      [{ id: 'a', sales_seen_at: null }],
      [{ request_id: 'a', responded_at: T1 }],
    )
    expect(n).toBe(1)
  })

  it('yanıttan SONRA bakılmış → sayılmaz', () => {
    const n = countUnseenResponses(
      [{ id: 'a', sales_seen_at: T2 }],
      [{ request_id: 'a', responded_at: T1 }],
    )
    expect(n).toBe(0)
  })

  it('bakıştan SONRA yeni yanıt gelmiş → tekrar sayılır', () => {
    const n = countUnseenResponses(
      [{ id: 'a', sales_seen_at: T1 }],
      [{ request_id: 'a', responded_at: T2 }],
    )
    expect(n).toBe(1)
  })

  it('birden fazla yanıt varsa EN YENİSİ dikkate alınır', () => {
    const seenBetween = { id: 'a', sales_seen_at: '2026-07-27T11:00:00.000Z' }
    const n = countUnseenResponses(
      [seenBetween],
      [
        { request_id: 'a', responded_at: T1 }, // bakıştan önce
        { request_id: 'a', responded_at: T2 }, // bakıştan sonra → sayılmalı
      ],
    )
    expect(n).toBe(1)
  })

  it('çoklu talep: yalnız bekleyenler sayılır', () => {
    const n = countUnseenResponses(
      [
        { id: 'a', sales_seen_at: null }, // sayılır
        { id: 'b', sales_seen_at: T2 }, // bakılmış
        { id: 'c', sales_seen_at: null }, // yanıt yok
      ],
      [
        { request_id: 'a', responded_at: T1 },
        { request_id: 'b', responded_at: T1 },
      ],
    )
    expect(n).toBe(1)
  })

  it('bozuk tarih güvenli işlenir', () => {
    const n = countUnseenResponses(
      [{ id: 'a', sales_seen_at: 'gecersiz' }],
      [{ request_id: 'a', responded_at: T1 }],
    )
    expect(n).toBe(1) // okunamayan bakış damgası → bakılmamış say
  })
})
