import { describe, it, expect } from 'vitest'
import { getLegalDocument, buildShareText } from '../index'
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

  it('metni henüz yazılmamış dilde tr fallback (bu task: ar)', () => {
    // Task 3 Arapça metni ekleyince bu beklenti DEĞİŞİR — o task testi günceller.
    expect(getLegalDocument('ar').title).toBe(getLegalDocument('tr').title)
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
