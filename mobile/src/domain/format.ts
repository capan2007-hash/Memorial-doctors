// Kaynak: /src/lib/format.ts (web) — Metro repo-kökü dışı import kısıtı nedeniyle kopyalandı.
export function timeAgo(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return 'az önce'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} dk önce`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} sa önce`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} gün önce`

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${day}.${month}.${year}`
}

/** Kaynak: /src/lib/format.ts formatMins (web) — dakikayı "{n} dk" / "{h} sa {m} dk" olarak biçimler. */
export function formatMins(n: number): string {
  const rounded = Math.round(n)
  if (rounded < 60) return `${rounded} dk`
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return `${h} sa ${m} dk`
}
