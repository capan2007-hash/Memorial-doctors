export type CatalogRef = { name: string; name_i18n?: Record<string, string> | null }

export function catalogName(row: CatalogRef, lang: string): string {
  return row.name_i18n?.[lang] ?? row.name
}
