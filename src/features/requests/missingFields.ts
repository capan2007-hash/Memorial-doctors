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

/** `requests.newRequest.missingLabels` altındaki anahtarlarla birebir eşleşir — çeviri çağrıcıda (NewRequestWizard) yapılır. */
export type MissingFieldKey =
  | 'first' | 'last' | 'phone' | 'age' | 'weight' | 'height' | 'gender'
  | 'category' | 'subcategory' | 'medical' | 'lifestyle' | 'photos'

/** canSubmit koşullarıyla aynı mantıktan türetilen, eksik alanların anahtarlarını sırayla döner. */
export function missingFields(i: MissingInput): MissingFieldKey[] {
  const out: MissingFieldKey[] = []
  if (!i.first) out.push('first')
  if (!i.last) out.push('last')
  if (!i.phoneOk) out.push('phone')
  if (!i.ageOk) out.push('age')
  if (!i.weightOk) out.push('weight')
  if (!i.heightOk) out.push('height')
  if (!i.gender) out.push('gender')
  if (!i.categoryId) out.push('category')
  if (i.needsSub && !i.subcategoryId) out.push('subcategory')
  if (!i.medicalOk) out.push('medical')
  if (!i.lifestyleOk) out.push('lifestyle')
  if (i.filesCount === 0) out.push('photos')
  return out
}
