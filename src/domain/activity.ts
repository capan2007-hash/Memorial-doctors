// Aktivite Akışı yardımcıları. activity_timeline RPC satırlarını görünür metne çevirir.
// Saf fonksiyonlar — UI'dan bağımsız test edilir.

/** Akışta rol ibaresi. agent→"Acenta" (Bookimed vb. medikal turizm acentaları), sales→"Satışçı". */
export function activityRoleLabel(role: string): string {
  switch (role) {
    case 'agent':
      return 'Acenta'
    case 'sales':
      return 'Satışçı'
    case 'coordinator':
      return 'Koordinatör'
    case 'admin':
      return 'Yönetici'
    case 'super_admin':
      return 'Süper Admin'
    case 'doctor':
      return 'Doktor'
    default:
      return 'Kullanıcı'
  }
}

/** Vaka türü: alt kırılım varsa o, yoksa kategori; ikisi de boşsa "estetik". */
export function caseTypeLabel(categoryName: string | null, subcategoryName: string | null): string {
  return (subcategoryName ?? categoryName ?? '').trim() || 'estetik'
}

/** "6 doktora yönlendirildi" (0 ise "doktora yönlendirilmedi" — akış normalde 0'ı filtreler). */
export function doctorCountText(n: number): string {
  return n > 0 ? `${n} doktora yönlendirildi` : 'doktora yönlendirilmedi'
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

/** Gün grubu başlığı: "Bugün" / "Dün" / "18 Temmuz 2026". now enjekte edilebilir (test). */
export function dayGroupLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Dün'
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Göreli zaman: "az önce" / "5 dk önce" / "3 sa önce" / "2 gün önce". now enjekte edilebilir. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const secs = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000))
  if (secs < 60) return 'az önce'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} dk önce`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} sa önce`
  return `${Math.floor(hours / 24)} gün önce`
}

/** "22.07.2026 · 23:15" (tr-TR, tarayıcının yerel saati). Geçersiz tarihte boş döner. */
export function formatActivityDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}
