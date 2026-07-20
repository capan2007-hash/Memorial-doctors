export const MODEL_ID = 'claude-opus-4-8'

export interface DupFeedbackHint { label: 'ok' | 'not_ok'; note: string | null }

export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    same: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string' },
  },
  required: ['same', 'confidence', 'reason'],
  additionalProperties: false,
} as const

export function buildSystemPrompt(): string {
  return [
    'Görevin: iki ayrı hasta başvurusuna ait fotoğraf gruplarının AYNI kişiye mi',
    'ait olduğunu değerlendirmek. Yalnızca kimlik/aynı-kişi eşleşmesi yap.',
    'ASLA teşhis, tedavi önerisi veya tıbbi yorum yapma. Çıktın yalnız koordinatöre',
    'yardımcı bir öneridir; nihai kararı insan verir. Emin değilsen düşük confidence ver.',
    'JSON şemasına uygun döndür: same (bool), confidence (0-1), reason (kısa).',
  ].join(' ')
}

export function buildUserContent(newUrls: string[], parentUrls: string[], hints: DupFeedbackHint[]) {
  const blocks: unknown[] = []
  blocks.push({ type: 'text', text: 'YENİ BAŞVURU fotoğrafları:' })
  for (const u of newUrls) blocks.push({ type: 'image', source: { type: 'url', url: u } })
  blocks.push({ type: 'text', text: 'ANA (ÖNCEKİ) BAŞVURU fotoğrafları:' })
  for (const u of parentUrls) blocks.push({ type: 'image', source: { type: 'url', url: u } })
  if (hints.length) {
    const lines = hints.map((h) => `- ${h.label === 'ok' ? 'AYNI kişiydi' : 'FARKLI kişiydi'}${h.note ? ' — ' + h.note : ''}`)
    blocks.push({ type: 'text', text: 'Koordinatörün geçmiş kararlarından örnekler (yön verici):\n' + lines.join('\n') })
  }
  return blocks
}

export interface VisionResult { same: boolean; confidence: number; reason: string }
export function parseVisionOutput(j: unknown): VisionResult | null {
  if (!j || typeof j !== 'object') return null
  const o = j as Record<string, unknown>
  if (typeof o.same !== 'boolean' || typeof o.confidence !== 'number' || typeof o.reason !== 'string') return null
  return { same: o.same, confidence: o.confidence, reason: o.reason }
}
