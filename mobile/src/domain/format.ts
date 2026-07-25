// Kaynak: /src/lib/format.ts (web) — Metro repo-kökü dışı import kısıtı nedeniyle kopyalandı.
// i18n: common.time.* (Faz M1 Task 6) — `t` çağıran taraftan alınır (bkz. PatientInfoCard.tsx
// smokingDisplay/alcoholDisplay ile aynı desen); namespace'ten bağımsız çalışması için
// anahtarlar `common:` öneki ile tam nitelenmiştir.
type TFunc = (key: string, opts?: Record<string, unknown>) => string

export function timeAgo(iso: string, t: TFunc, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return t('common:time.justNow')

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return t('common:time.minutesAgo', { count: diffMin })

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return t('common:time.hoursAgo', { count: diffHour })

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return t('common:time.daysAgo', { count: diffDay })

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${day}.${month}.${year}`
}

/** Kaynak: /src/lib/format.ts formatMins (web) — dakikayı "{n} dk" / "{h} sa {m} dk" olarak biçimler. */
export function formatMins(n: number, t: TFunc): string {
  const rounded = Math.round(n)
  if (rounded < 60) return t('common:time.minutesShort', { count: rounded })
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return t('common:time.hoursMinutesShort', { hours: h, minutes: m })
}
