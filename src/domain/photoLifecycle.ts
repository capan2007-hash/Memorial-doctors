// M4 fotoğraf yaşam döngüsü (BRD §7.8): request.sale_status'e göre fotoğrafların
// hangi aşamada olduğunu ve kalan gün sayısını hesaplayan saf yardımcı.
// Süreler (retention/buffer) koda gömülmez — tenant ayarlarından gelir.

export interface PhotoLifecycleInfo {
  state: 'active_countdown' | 'archived' | 'operation_buffer'
  daysLeft: number
}

interface PhotoLifecycleDates {
  oldestUploadedAt: string | null
  saleMarkedAt: string | null
}

function daysSince(iso: string, now: Date): number {
  const diffMs = now.getTime() - new Date(iso).getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function photoLifecycleInfo(
  saleStatus: string,
  dates: PhotoLifecycleDates,
  retentionDays: number,
  opBufferDays: number,
  now: Date = new Date()
): PhotoLifecycleInfo | null {
  // `offer_sent` (fiyat teklifi verildi) satış AŞAMASINDA bir ara durumdur: satış
  // henüz kapanmadığı için fotoğraflar aktif kalır ve saklama geri sayımı sürer —
  // `not_completed` ile aynı davranır (aksi halde teklif verilince geri sayım kaybolurdu).
  if (saleStatus === 'not_completed' || saleStatus === 'offer_sent') {
    if (!dates.oldestUploadedAt) return null
    const daysLeft = Math.max(0, retentionDays - daysSince(dates.oldestUploadedAt, now))
    return { state: 'active_countdown', daysLeft }
  }
  if (saleStatus === 'sale_done') {
    return { state: 'archived', daysLeft: 0 }
  }
  if (saleStatus === 'operation_done') {
    if (!dates.saleMarkedAt) return null
    const daysLeft = Math.max(0, opBufferDays - daysSince(dates.saleMarkedAt, now))
    return { state: 'operation_buffer', daysLeft }
  }
  return null
}
