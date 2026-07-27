// Talep listesi araması: hasta adı/soyadı (ad birleşik `patientName`) veya telefon.
// İstemci-taraflı filtre (yüklenen liste üzerinde). Telefon aramasında her iki taraf
// da yalnız rakamlara indirgenir → biçim farkları (boşluk/tire/+90/0) sorun olmaz.

export interface SearchableRequest {
  patientName: string
  patientPhone?: string | null
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

export function matchesSearch(row: SearchableRequest, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (row.patientName.toLowerCase().includes(q)) return true
  const qDigits = digitsOnly(query)
  // En az 3 hane girilince telefon eşleşmesi dene (tek-iki hane gürültü olmasın).
  if (qDigits.length >= 3 && digitsOnly(row.patientPhone ?? '').includes(qDigits)) return true
  return false
}

export function filterBySearch<T extends SearchableRequest>(rows: T[], query: string): T[] {
  if (!query.trim()) return rows
  return rows.filter((r) => matchesSearch(r, query))
}
