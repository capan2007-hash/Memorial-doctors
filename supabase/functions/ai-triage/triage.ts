// Saf TypeScript modül: Deno'ya özgü import YOK, npm: import YOK.
// Hem Deno edge function (ai-triage/index.ts) hem de vitest tarafından
// göreli yoldan import edilir.

import { scrubPii } from './scrub.ts'

export const MODEL_ID = 'claude-opus-4-8'

export const DISCLAIMER =
  'Bu değerlendirme yalnızca dahili triyaj amaçlıdır; teşhis veya tedavi kararı değildir. Nihai tıbbi görüş hekime aittir.'

export const WARNING_TYPES = [
  'photo_operation_mismatch',
  'demographics_operation_risk',
  'missing_data',
  'photo_quality',
] as const

export type WarningType = (typeof WARNING_TYPES)[number]

export interface TriageWarning {
  type: WarningType
  confidence: number
  rationale: string
}

export interface TriagePatient {
  age: number | null
  heightCm: number | null
  weightKg: number | null
  gender: string | null
  pastSurgeries: string
  knownConditions: string
  medications: string
  notes: string | null
  smokingStatus: string | null
  smokingPackYears: number | null
  alcoholStatus: string | null
  alcoholDrinksPerWeek: number | null
}

export interface TriageOperation {
  category: string
  subcategory: string | null
  operationType: string | null
}

export interface TriageDoctorCard {
  title: string | null
  specialty: string | null
  bio: string | null
  weightedWork: unknown
}

export interface FeedbackHint {
  label: 'correct' | 'partial' | 'wrong'
  note: string | null
  summary: string
}

export interface TriageContext {
  patient: TriagePatient
  operation: TriageOperation
  doctors: TriageDoctorCard[]
  feedbackHints: FeedbackHint[]
}

export function buildSystemPrompt(): string {
  return [
    'Sen estetik cerrahi kliniği için DAHİLİ triyaj yardımcısısın; çıktın yalnız hekim ve klinik ekibine yöneliktir.',
    '',
    'Katı sınırların: teşhis koymazsın, tedavi reçete etmezsin, operasyon onayı veya reddi vermezsin, ' +
      'hastaya yönelik mesaj üretmezsin; çıktın yalnızca hekime yönelik dahili karar desteğidir.',
    '',
    'Görevin: sağlanan fotoğraflar (varsa diş röntgenleri dahil), hastanın istediği operasyon ve ' +
      'demografi/tıbbi bilgileri arasındaki tutarlılığı değerlendirmek. Aşağıdaki dört uyarı tipinden ' +
      'hangilerinin geçerli olduğunu belirle:',
    '- photo_operation_mismatch: fotoğraflar, talep edilen operasyonla tutarsız görünüyor.',
    '- demographics_operation_risk: yaş, boy, kilo, cinsiyet veya yaşam tarzı (yoğun sigara — yüksek ' +
      'paket-yıl — ve/veya ağır alkol kullanımı yara iyileşmesi, anestezi ve kanama riskini artırır) ' +
      'talep edilen operasyon için risk oluşturabilir.',
    '- missing_data: değerlendirme için gerekli bilgi (fotoğraf, tıbbi geçmiş vb.) eksik.',
    '- photo_quality: fotoğraf kalitesi (bulanıklık, açı, ışık) değerlendirmeyi güçleştiriyor.',
    '',
    'suitability_note alanında hastanın talebi, demografisi, tıbbi geçmişi ve fotoğraflara göre hangi ' +
      'işlemlerin uygun görünebileceğini ve nelere dikkat edilmesi gerektiğini kısa, yön gösterici Türkçe ' +
      'metinle açıkla.',
    '',
    'Yanıtını daima Türkçe ver ve yalnızca istenen yapılandırılmış şemaya uygun çıktı üret.',
    '',
    'Hastanın adını asla kullanma; çıktında hastayı tanımlayabilecek kişisel veri (ad, telefon, kimlik numarası) yazma.',
  ].join('\n')
}

function smokingLabel(s: string | null): string {
  return s === 'current' ? 'aktif içici' : s === 'former' ? 'bıraktı' : s === 'never' ? 'hiç kullanmadı' : 'belirtilmemiş'
}

function alcoholLabel(s: string | null): string {
  return s === 'regular' ? 'düzenli' : s === 'occasional' ? 'sosyal' : s === 'never' ? 'hiç' : 'belirtilmemiş'
}

function formatWeightedWork(weightedWork: unknown): string {
  try {
    return JSON.stringify(weightedWork ?? null)
  } catch {
    return 'null'
  }
}

function buildSummaryText(ctx: TriageContext): string {
  const { patient, operation, doctors, feedbackHints } = ctx
  const lines: string[] = []

  lines.push('Hasta bilgileri (ad hariç):')
  lines.push(`- Yaş: ${patient.age ?? 'belirtilmemiş'}`)
  lines.push(`- Cinsiyet: ${patient.gender ?? 'belirtilmemiş'}`)
  lines.push(`- Boy (cm): ${patient.heightCm ?? 'belirtilmemiş'}`)
  lines.push(`- Kilo (kg): ${patient.weightKg ?? 'belirtilmemiş'}`)
  lines.push(`- Geçirilmiş ameliyatlar: ${scrubPii(patient.pastSurgeries)}`)
  lines.push(`- Bilinen rahatsızlıklar: ${scrubPii(patient.knownConditions)}`)
  lines.push(`- Kullanılan ilaçlar: ${scrubPii(patient.medications)}`)
  lines.push(
    `- Sigara: ${smokingLabel(patient.smokingStatus)}` +
      (patient.smokingPackYears != null ? `, ${patient.smokingPackYears} paket-yıl` : ''),
  )
  lines.push(
    `- Alkol: ${alcoholLabel(patient.alcoholStatus)}` +
      (patient.alcoholDrinksPerWeek != null ? `, ${patient.alcoholDrinksPerWeek}/hafta` : ''),
  )
  lines.push(`- Not: ${patient.notes ? scrubPii(patient.notes) : 'yok'}`)
  lines.push('')
  lines.push('İstenen operasyon:')
  lines.push(`- Kategori: ${operation.category}`)
  lines.push(`- Alt kırılım: ${operation.subcategory ?? 'yok'}`)
  lines.push(`- İşlem tipi: ${operation.operationType ?? 'yok'}`)

  if (doctors.length > 0) {
    lines.push('')
    lines.push('Atanan doktor kartları:')
    doctors.forEach((d, i) => {
      lines.push(
        `- Doktor ${i + 1}: unvan=${d.title ?? 'yok'}, branş=${d.specialty ?? 'yok'}, ` +
          `bio=${d.bio ?? 'yok'}, ağırlıklı işler=${formatWeightedWork(d.weightedWork)}`,
      )
    })
  }

  if (feedbackHints.length > 0) {
    lines.push('')
    lines.push('Geçmiş doktor geri bildirimlerinden ipuçları:')
    feedbackHints.forEach((f) => {
      const summary = scrubPii(f.summary)
      const note = f.note ? scrubPii(f.note) : null
      lines.push(`- [${f.label}] ${summary}${note ? ` (${note})` : ''}`)
    })
  }

  return lines.join('\n')
}

export function buildUserContent(ctx: TriageContext, photoUrls: string[], xrayUrls: string[]): unknown[] {
  const blocks: unknown[] = []

  for (const url of photoUrls) {
    blocks.push({ type: 'image', source: { type: 'url', url } })
  }

  if (xrayUrls.length > 0) {
    blocks.push({ type: 'text', text: 'Aşağıdaki görseller diş röntgenidir:' })
    for (const url of xrayUrls) {
      blocks.push({ type: 'image', source: { type: 'url', url } })
    }
  }

  blocks.push({ type: 'text', text: buildSummaryText(ctx) })

  return blocks
}

export const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'warning'] },
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: WARNING_TYPES as unknown as string[] },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
        },
        required: ['type', 'confidence', 'rationale'],
        additionalProperties: false,
      },
    },
    suitability_note: { type: 'string' },
  },
  required: ['status', 'warnings', 'suitability_note'],
  additionalProperties: false,
}

export interface TriageResult {
  status: 'ok' | 'warning'
  warnings: TriageWarning[]
  suitabilityNote: string
}

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function isWarningType(t: unknown): t is WarningType {
  return typeof t === 'string' && (WARNING_TYPES as readonly string[]).includes(t)
}

export function parseTriageOutput(raw: unknown): TriageResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>

  if (obj.status !== 'ok' && obj.status !== 'warning') return null

  const rawWarnings = Array.isArray(obj.warnings) ? obj.warnings : []
  const warnings: TriageWarning[] = []
  for (const w of rawWarnings) {
    if (typeof w !== 'object' || w === null) continue
    const wo = w as Record<string, unknown>
    if (!isWarningType(wo.type)) continue
    const confidence = typeof wo.confidence === 'number' && !Number.isNaN(wo.confidence) ? clamp01(wo.confidence) : 0
    const rationale = typeof wo.rationale === 'string' ? wo.rationale : ''
    warnings.push({ type: wo.type, confidence, rationale })
  }

  const suitabilityNote = typeof obj.suitability_note === 'string' ? obj.suitability_note : ''

  const status: 'ok' | 'warning' = obj.status === 'warning' && warnings.length === 0 ? 'ok' : obj.status

  return { status, warnings, suitabilityNote }
}
