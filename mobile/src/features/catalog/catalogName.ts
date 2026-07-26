// Kaynak: /src/features/catalog/catalogName.ts (web) — birebir mirror. Katalog
// (category/subcategory/operation_type) satırlarının adını aktif dile çözer;
// name_i18n'de dil yoksa Türkçe (row.name) köküne düşer. Hasta ad/telefon/sayı
// ÇEVRİLMEZ — bu yalnız katalog verisi içindir.
export type CatalogRef = { name: string; name_i18n?: Record<string, string> | null }

export function catalogName(row: CatalogRef, lang: string): string {
  return row.name_i18n?.[lang] ?? row.name
}
