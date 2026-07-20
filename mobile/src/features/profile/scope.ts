// Saf yetkinlik (doctor_scope) seçim mantığı — supabase bağımlılığı YOK ki
// birim testlerinde native modül (AsyncStorage) yüklenmeden import edilebilsin.

export interface DoctorScope {
  categoryId: string
  subcategoryId: string | null
}

/** Bir yetkinlik (kategori + opsiyonel alt kırılım) seçili mi? */
export function hasScope(scopes: DoctorScope[], categoryId: string, subcategoryId: string | null): boolean {
  return scopes.some((s) => s.categoryId === categoryId && s.subcategoryId === subcategoryId)
}

/** Yetkinliği ekler ya da (zaten varsa) çıkarır — saf, immutable. */
export function toggleScope(scopes: DoctorScope[], entry: DoctorScope): DoctorScope[] {
  if (hasScope(scopes, entry.categoryId, entry.subcategoryId)) {
    return scopes.filter((s) => !(s.categoryId === entry.categoryId && s.subcategoryId === entry.subcategoryId))
  }
  return [...scopes, entry]
}
