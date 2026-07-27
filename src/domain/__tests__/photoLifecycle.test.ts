import { describe, it, expect } from 'vitest'
import { photoLifecycleInfo } from '../photoLifecycle'

const NOW = new Date('2026-07-19T12:00:00.000Z')

describe('photoLifecycleInfo', () => {
  it('not_completed: aktif geri sayım, yüklemeden bu yana geçen gün retention_days\'ten düşülür', () => {
    const uploadedAt = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 gün önce
    expect(
      photoLifecycleInfo('not_completed', { oldestUploadedAt: uploadedAt, saleMarkedAt: null }, 60, 30, NOW)
    ).toEqual({ state: 'active_countdown', daysLeft: 50 })
  })

  it('sale_done: arşivlendi, daysLeft her zaman 0', () => {
    expect(
      photoLifecycleInfo('sale_done', { oldestUploadedAt: null, saleMarkedAt: null }, 60, 30, NOW)
    ).toEqual({ state: 'archived', daysLeft: 0 })
  })

  it('operation_done: tampon geri sayımı, sale_marked_at\'ten bu yana geçen gün op_buffer_days\'ten düşülür', () => {
    const saleMarkedAt = new Date(NOW.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString() // 25 gün önce
    expect(
      photoLifecycleInfo('operation_done', { oldestUploadedAt: null, saleMarkedAt }, 60, 30, NOW)
    ).toEqual({ state: 'operation_buffer', daysLeft: 5 })
  })

  it('sınır: retention süresi dolmuşsa daysLeft negatife düşmez, 0\'da kalır', () => {
    const uploadedAt = new Date(NOW.getTime() - 70 * 24 * 60 * 60 * 1000).toISOString() // 70 gün önce, retention 60
    expect(
      photoLifecycleInfo('not_completed', { oldestUploadedAt: uploadedAt, saleMarkedAt: null }, 60, 30, NOW)
    ).toEqual({ state: 'active_countdown', daysLeft: 0 })
  })

  it('sınır: tampon süresi tam bugün doluyorsa daysLeft 0', () => {
    const saleMarkedAt = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() // tam 30 gün önce, buffer 30
    expect(
      photoLifecycleInfo('operation_done', { oldestUploadedAt: null, saleMarkedAt }, 60, 30, NOW)
    ).toEqual({ state: 'operation_buffer', daysLeft: 0 })
  })

  it('not_completed ama foto yoksa (oldestUploadedAt null) → null', () => {
    expect(
      photoLifecycleInfo('not_completed', { oldestUploadedAt: null, saleMarkedAt: null }, 60, 30, NOW)
    ).toBeNull()
  })

  it('operation_done ama sale_marked_at yoksa → null', () => {
    expect(
      photoLifecycleInfo('operation_done', { oldestUploadedAt: null, saleMarkedAt: null }, 60, 30, NOW)
    ).toBeNull()
  })

  it('bilinmeyen sale_status → null', () => {
    expect(
      photoLifecycleInfo('unknown', { oldestUploadedAt: null, saleMarkedAt: null }, 60, 30, NOW)
    ).toBeNull()
  })
})

describe('offer_sent (fiyat teklifi verildi)', () => {
  it('not_completed gibi davranır: geri sayım sürer, arşive geçmez', () => {
    const info = photoLifecycleInfo(
      'offer_sent',
      { oldestUploadedAt: '2026-07-01T00:00:00.000Z', saleMarkedAt: null },
      60,
      30,
      new Date('2026-07-27T00:00:00.000Z'),
    )
    expect(info).toEqual({ state: 'active_countdown', daysLeft: 34 })
  })
})
