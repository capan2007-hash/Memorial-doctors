// Kaynak: /src/features/requests/searchRequests.ts (web) — mobil mirror.
// Talep listesi araması: hasta adı/soyadı veya telefon. Telefon aramasında her iki
// taraf da yalnız rakamlara indirgenir (biçim farkı önemsiz).

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
  if (qDigits.length >= 3 && digitsOnly(row.patientPhone ?? '').includes(qDigits)) return true
  return false
}

export function filterBySearch<T extends SearchableRequest>(rows: T[], query: string): T[] {
  if (!query.trim()) return rows
  return rows.filter((r) => matchesSearch(r, query))
}
