// Aktivite Akışı yardımcıları. activity_timeline RPC satırlarını görünür metne çevirir.
// Saf fonksiyonlar — UI'dan bağımsız test edilir. Metin çıktısı üreten fonksiyonlar
// `activity` i18n namespace'ine bağlı `t` (TFunction) alır; sunucu tarafı dil değişse de saf kalır.
import type { TFunction } from 'i18next'

/** Akışta rol ibaresi. agent→"Acenta" (Bookimed vb. medikal turizm acentaları), sales→"Satışçı". */
export function activityRoleLabel(role: string, t: TFunction): string {
  switch (role) {
    case 'agent':
      return t('role.agent')
    case 'sales':
      return t('role.sales')
    case 'coordinator':
      return t('role.coordinator')
    case 'admin':
      return t('role.admin')
    case 'super_admin':
      return t('role.superAdmin')
    case 'doctor':
      return t('role.doctor')
    default:
      return t('role.default')
  }
}

/** Vaka türü: alt kırılım varsa o, yoksa kategori; ikisi de boşsa "estetik". */
export function caseTypeLabel(categoryName: string | null, subcategoryName: string | null, t: TFunction): string {
  return (subcategoryName ?? categoryName ?? '').trim() || t('caseType.fallback')
}

/** "6 doktora yönlendirildi" (0 ise "doktora yönlendirilmedi" — akış normalde 0'ı filtreler). */
export function doctorCountText(n: number, t: TFunction): string {
  return n > 0 ? t('doctorCount.referred', { count: n }) : t('doctorCount.none')
}

/** Role göre vurgu tonu: satışçı→mavi (info), acenta→amber (warning), diğerleri→teal (brand). */
export type ActivityTone = 'info' | 'warning' | 'brand'
export function roleAccentTone(role: string): ActivityTone {
  if (role === 'agent') return 'warning'
  if (role === 'sales') return 'info'
  return 'brand'
}

/** Gruplama anahtarı: yerel takvim günü (YYYY-MM-DD). Geçersiz tarihte boş. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Gün grubu başlığı: "Bugün" / "Dün" / yerelleştirilmiş tam tarih. now enjekte edilebilir (test). */
export function dayGroupLabel(iso: string, t: TFunction, lang: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diff === 0) return t('dayGroup.today')
  if (diff === 1) return t('dayGroup.yesterday')
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Göreli zaman: "az önce" / "5 dk önce" / "3 sa önce" / "2 gün önce". now enjekte edilebilir. */
export function relativeTime(iso: string, t: TFunction, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const secs = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000))
  if (secs < 60) return t('relative.justNow')
  const mins = Math.floor(secs / 60)
  if (mins < 60) return t('relative.minutes', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('relative.hours', { count: hours })
  return t('relative.days', { count: Math.floor(hours / 24) })
}

/** "22.07.2026 · 23:15" (aktif dile göre, tarayıcının yerel saati). Geçersiz tarihte boş döner. */
export function formatActivityDateTime(iso: string, lang: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}
