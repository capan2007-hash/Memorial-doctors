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

/** "22.07.2026 · 23:15" (tr-TR, tarayıcının yerel saati). Geçersiz tarihte boş döner. */
export function formatActivityDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}
