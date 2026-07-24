export function catalogName(row: { name: string; name_i18n?: Record<string, string> | null }, lang: string): string {
  return row.name_i18n?.[lang] ?? row.name
}
