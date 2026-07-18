// Yeni talep formu için sayfa içi (in-memory) taslak deposu.
// Sayfa yenilendiğinde kaybolur — bu kabul edilen bir sınırdır (kalıcılık ileride localStorage ile eklenebilir).

export interface MedicalDraft {
  none: boolean
  text: string
}

export interface RequestDraft {
  first: string
  last: string
  age: string
  weightKg: string
  heightCm: string
  gender: '' | 'female' | 'male' | 'other'
  pastSurgeries: MedicalDraft
  knownConditions: MedicalDraft
  medications: MedicalDraft
  categoryId: string
  subcategoryId: string | null
  operationTypeId: string | null
  notes: string
  files: File[]
  xrayFiles: File[]
}

let draft: RequestDraft | null = null

export function saveDraft(d: RequestDraft): void {
  draft = d
}

export function loadDraft(): RequestDraft | null {
  return draft
}

export function clearDraft(): void {
  draft = null
}

function medicalEmpty(m: MedicalDraft): boolean {
  return !m.none && !m.text
}

export function isDraftEmpty(d: RequestDraft): boolean {
  return (
    !d.first && !d.last && !d.age && !d.weightKg && !d.heightCm &&
    d.gender === '' &&
    medicalEmpty(d.pastSurgeries) && medicalEmpty(d.knownConditions) && medicalEmpty(d.medications) &&
    !d.categoryId && !d.subcategoryId && !d.operationTypeId &&
    !d.notes && d.files.length === 0 && d.xrayFiles.length === 0
  )
}
