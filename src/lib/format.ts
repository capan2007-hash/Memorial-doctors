import i18n from '../i18n'

export function timeAgo(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return i18n.t('time.justNow', { ns: 'common' })

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return i18n.t('time.minutesAgo', { ns: 'common', count: diffMin })

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return i18n.t('time.hoursAgo', { ns: 'common', count: diffHour })

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return i18n.t('time.daysAgo', { ns: 'common', count: diffDay })

  return formatDate(iso)
}

/** dd.mm.yyyy biçiminde tarih (imha/arşiv göstergeleri için, M4). */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${day}.${month}.${year}`
}

/** Dakikayı okunur süreye çevirir: <60 → "N dk", aksi halde "H sa M dk". */
export function formatMins(n: number): string {
  const rounded = Math.round(n)
  if (rounded < 60) return `${rounded} ${i18n.t('time.minutesShort', { ns: 'common' })}`
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return `${h} ${i18n.t('time.hoursShort', { ns: 'common' })} ${m} ${i18n.t('time.minutesShort', { ns: 'common' })}`
}

/** <input type="date"> için yerel tarih (toISOString/UTC gece 03:00 öncesi TR'de bir önceki günü gösterirdi). */
export function toDateInputValue(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** "yyyy-mm-dd" girişini günün başlangıcı olarak ISO'ya çevirir. */
export function startOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000`).toISOString()
}

/** "yyyy-mm-dd" girişini günün sonu olarak ISO'ya çevirir. */
export function endOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999`).toISOString()
}
