export interface MissingInput {
  first: string
  last: string
  phoneOk: boolean
  ageOk: boolean
  weightOk: boolean
  heightOk: boolean
  gender: string
  categoryId: string
  needsSub: boolean
  subcategoryId: string | null
  medicalOk: boolean
  lifestyleOk: boolean
  filesCount: number
}

/** canSubmit koşullarıyla aynı mantıktan türetilen, eksik alanların Türkçe adlarını sırayla döner. */
export function missingFields(i: MissingInput): string[] {
  const out: string[] = []
  if (!i.first) out.push('Ad')
  if (!i.last) out.push('Soyad')
  if (!i.phoneOk) out.push('Telefon')
  if (!i.ageOk) out.push('Yaş')
  if (!i.weightOk) out.push('Kilo')
  if (!i.heightOk) out.push('Boy')
  if (!i.gender) out.push('Cinsiyet')
  if (!i.categoryId) out.push('Kategori')
  if (i.needsSub && !i.subcategoryId) out.push('Alt kırılım')
  if (!i.medicalOk) out.push('Tıbbi geçmiş')
  if (!i.lifestyleOk) out.push('Sigara/alkol bilgisi')
  if (i.filesCount === 0) out.push('Fotoğraf')
  return out
}
