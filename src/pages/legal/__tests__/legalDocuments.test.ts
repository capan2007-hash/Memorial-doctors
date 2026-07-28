import { describe, it, expect } from 'vitest'
import { SUPPORTED } from '../../../i18n'
import { getLegalDocument, buildShareText, LEGAL_DOCUMENTS } from '../index'
import { CLINIC_IDENTITY, IDENTITY_COMPLETE } from '../clinicIdentity'
import { RETENTION } from '../retention'
import { SECTION_IDS, LEGAL_VERSION } from '../types'

describe('getLegalDocument', () => {
  it('tr dokümanını döner', () => {
    const doc = getLegalDocument('tr')
    expect(doc.version).toBe(LEGAL_VERSION)
    expect(doc.sections.map((s) => s.id)).toEqual([...SECTION_IDS])
  })

  it('bilinmeyen dil kodunda tr fallback', () => {
    expect(getLegalDocument('xx').title).toBe(getLegalDocument('tr').title)
  })

  it('ar artık kendi metnini döner (tr fallback DEĞİL)', () => {
    expect(getLegalDocument('ar').title).not.toBe(getLegalDocument('tr').title)
  })

  it('bölge kodlu dili taban dile indirir (tr-TR → tr)', () => {
    expect(getLegalDocument('tr-TR').title).toBe(getLegalDocument('tr').title)
  })

  it('boş/null dilde tr fallback', () => {
    expect(getLegalDocument(null).title).toBe(getLegalDocument('tr').title)
    expect(getLegalDocument('').title).toBe(getLegalDocument('tr').title)
  })
})

describe('buildShareText', () => {
  it('{{link}} yer tutucusunu ?lang= linkiyle doldurur', () => {
    const text = buildShareText('tr', 'https://medtriage.rememore.workers.dev')
    expect(text).toContain('https://medtriage.rememore.workers.dev/aydinlatma?lang=tr')
    expect(text).not.toContain('{{link}}')
  })
})

describe('altı dil paritesi', () => {
  const docs = SUPPORTED.map(
    (lang) => [lang, LEGAL_DOCUMENTS[lang](CLINIC_IDENTITY, RETENTION)] as const,
  )

  it('altı dilin tamamı tanımlı ve birbirinden farklı metinler', () => {
    expect(docs).toHaveLength(6)
    const titles = new Set(docs.map(([, d]) => d.title))
    expect(titles.size).toBe(6)
  })

  it.each(docs)('%s: sürüm LEGAL_VERSION ile aynı', (_lang, doc) => {
    expect(doc.version).toBe(LEGAL_VERSION)
  })

  it.each(docs)('%s: bölüm kimlikleri ve sırası SECTION_IDS ile aynı', (_lang, doc) => {
    expect(doc.sections.map((s) => s.id)).toEqual([...SECTION_IDS])
  })

  it.each(docs)('%s: paragraf sayıları Türkçe ile aynı', (_lang, doc) => {
    const tr = LEGAL_DOCUMENTS.tr(CLINIC_IDENTITY, RETENTION)
    expect(doc.sections.map((s) => s.paragraphs.length)).toEqual(
      tr.sections.map((s) => s.paragraphs.length),
    )
  })

  it.each(docs)('%s: emphasis bayrakları Türkçe ile aynı', (_lang, doc) => {
    const tr = LEGAL_DOCUMENTS.tr(CLINIC_IDENTITY, RETENTION)
    expect(doc.sections.map((s) => s.emphasis ?? false)).toEqual(
      tr.sections.map((s) => s.emphasis ?? false),
    )
  })

  it.each(docs)('%s: boş başlık veya boş paragraf yok', (_lang, doc) => {
    expect(doc.title.trim()).not.toBe('')
    expect(doc.draftWarning.trim()).not.toBe('')
    expect(doc.updatedLabel.trim()).not.toBe('')
    for (const s of doc.sections) {
      expect(s.heading.trim()).not.toBe('')
      for (const p of s.paragraphs) expect(p.trim()).not.toBe('')
    }
  })

  it.each(docs)('%s: shareMessage {{link}} yer tutucusu içerir', (_lang, doc) => {
    expect(doc.shareMessage).toContain('{{link}}')
  })

  it.each(docs)('%s: kimlik tamsa yer tutucu kalıntısı yok', (_lang, doc) => {
    if (!IDENTITY_COMPLETE) return // kimlik boşken bu koruma anlamsız
    const all = doc.sections.flatMap((s) => [s.heading, ...s.paragraphs]).join(' ')
    expect(all).not.toMatch(/[[\]]/)
  })

  it.each(docs)('%s: yön kontrol karakteri içermez', (_lang, doc) => {
    const all = [doc.title, doc.subtitle, doc.draftWarning, doc.shareMessage,
      ...doc.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join(' ')
    expect(all).not.toMatch(/[‎‏؜‪-‮⁦-⁩]/)
  })
})
