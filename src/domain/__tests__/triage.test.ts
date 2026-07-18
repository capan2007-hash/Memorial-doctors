import { describe, it, expect } from 'vitest'
import {
  buildSystemPrompt,
  buildUserContent,
  parseTriageOutput,
  OUTPUT_SCHEMA,
  type TriageContext,
} from '../../../supabase/functions/ai-triage/triage'

const ctx: TriageContext = {
  patient: {
    fullName: 'Ayşe Yılmaz',
    age: 34,
    heightCm: 165,
    weightKg: 62,
    gender: 'kadın',
    pastSurgeries: 'Yok',
    knownConditions: 'Diyabet',
    medications: 'Metformin',
    notes: 'Sigara kullanmıyor',
  },
  operation: {
    category: 'plastik',
    subcategory: 'burun',
    operationType: 'rinoplasti',
  },
  doctors: [
    { title: 'Op. Dr.', specialty: 'Plastik Cerrahi', bio: 'Deneyimli', weightedWork: { items: [] } },
  ],
  feedbackHints: [
    { label: 'correct', note: 'İyi eşleşme', summary: 'Geçmişte doğru atama' },
  ],
}

describe('parseTriageOutput', () => {
  it('geçerli örnek round-trip', () => {
    const raw = {
      status: 'warning',
      warnings: [{ type: 'photo_quality', confidence: 0.8, rationale: 'Bulanık fotoğraf' }],
      suitability_note: 'Genel olarak uygun görünüyor.',
    }
    expect(parseTriageOutput(raw)).toEqual({
      status: 'warning',
      warnings: [{ type: 'photo_quality', confidence: 0.8, rationale: 'Bulanık fotoğraf' }],
      suitabilityNote: 'Genel olarak uygun görünüyor.',
    })
  })

  it('raw string ise null döner', () => {
    expect(parseTriageOutput('not an object')).toBeNull()
  })

  it('raw null ise null döner', () => {
    expect(parseTriageOutput(null)).toBeNull()
  })

  it('bilinmeyen warning type filtrelenir', () => {
    const raw = {
      status: 'warning',
      warnings: [
        { type: 'unknown_type', confidence: 0.5, rationale: 'x' },
        { type: 'missing_data', confidence: 0.5, rationale: 'y' },
      ],
      suitability_note: 'not',
    }
    const result = parseTriageOutput(raw)
    expect(result?.warnings).toEqual([{ type: 'missing_data', confidence: 0.5, rationale: 'y' }])
  })

  it('confidence 1.4 -> 1e clamp edilir', () => {
    const raw = {
      status: 'warning',
      warnings: [{ type: 'missing_data', confidence: 1.4, rationale: 'x' }],
      suitability_note: 'not',
    }
    const result = parseTriageOutput(raw)
    expect(result?.warnings[0].confidence).toBe(1)
  })

  it('confidence -0.4 -> 0a clamp edilir', () => {
    const raw = {
      status: 'warning',
      warnings: [{ type: 'missing_data', confidence: -0.4, rationale: 'x' }],
      suitability_note: 'not',
    }
    const result = parseTriageOutput(raw)
    expect(result?.warnings[0].confidence).toBe(0)
  })

  it('tüm warning tipleri filtrelenince status ok a düşer', () => {
    const raw = {
      status: 'warning',
      warnings: [{ type: 'unknown_type', confidence: 0.5, rationale: 'x' }],
      suitability_note: 'not',
    }
    expect(parseTriageOutput(raw)?.status).toBe('ok')
    expect(parseTriageOutput(raw)?.warnings).toEqual([])
  })

  it('geçersiz status degeri null döner', () => {
    expect(parseTriageOutput({ status: 'weird', warnings: [], suitability_note: 'x' })).toBeNull()
  })
})

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt()

  it('4 zorunlu yasak ifadeyi içerir', () => {
    expect(prompt).toContain('teşhis koymazsın')
    expect(prompt).toContain('tedavi reçete etmezsin')
    expect(prompt).toContain('operasyon onayı veya reddi vermezsin')
    expect(prompt).toContain('hastaya yönelik mesaj üretmezsin')
  })

  it('rol tanımını içerir', () => {
    expect(prompt).toContain('DAHİLİ triyaj yardımcısısın')
  })
})

describe('buildUserContent', () => {
  it('2 foto + 1 xray -> 2+1 image bloğu + xray işaret metni + özet bloğu; ad geçmez', () => {
    const blocks = buildUserContent(ctx, ['https://x/1.jpg', 'https://x/2.jpg'], ['https://x/xray1.jpg'])

    expect(blocks).toHaveLength(5)
    expect(blocks[0]).toEqual({ type: 'image', source: { type: 'url', url: 'https://x/1.jpg' } })
    expect(blocks[1]).toEqual({ type: 'image', source: { type: 'url', url: 'https://x/2.jpg' } })
    expect(blocks[2]).toEqual({ type: 'text', text: 'Aşağıdaki görseller diş röntgenidir:' })
    expect(blocks[3]).toEqual({ type: 'image', source: { type: 'url', url: 'https://x/xray1.jpg' } })

    const summaryBlock = blocks[4] as { type: string; text: string }
    expect(summaryBlock.type).toBe('text')
    expect(summaryBlock.text).not.toContain('Ayşe Yılmaz')
  })

  it('xray yoksa xray işaret metni eklenmez', () => {
    const blocks = buildUserContent(ctx, ['https://x/1.jpg'], [])
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'image', source: { type: 'url', url: 'https://x/1.jpg' } })
  })
})

describe('OUTPUT_SCHEMA', () => {
  it('required alanları içerir', () => {
    const schema = OUTPUT_SCHEMA as { required: string[] }
    expect(schema.required).toEqual(expect.arrayContaining(['status', 'warnings', 'suitability_note']))
  })
})
