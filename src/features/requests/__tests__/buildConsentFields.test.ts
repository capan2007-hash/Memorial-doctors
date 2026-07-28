import { describe, it, expect } from 'vitest'
import { buildConsentFields } from '../useRequests'
import { LEGAL_VERSION } from '../../../pages/legal/types'

describe('buildConsentFields', () => {
  const base = { consentGiven: true, createdBy: 'user-1', consentLang: 'ar', sourceLang: 'tr' }

  it('onam verildiyse consent_text_version = LEGAL_VERSION ve consent_lang seçilen dil', () => {
    const fields = buildConsentFields(base)
    expect(fields).toMatchObject({
      consent_channel: 'whatsapp',
      consented_by: 'user-1',
      consent_text_version: LEGAL_VERSION,
      consent_lang: 'ar',
    })
    expect(typeof (fields as { consent_at?: string }).consent_at).toBe('string')
  })

  it('consentLang belirtilmemişse sourceLang\'e düşer', () => {
    const fields = buildConsentFields({ ...base, consentLang: undefined })
    expect((fields as { consent_lang?: string }).consent_lang).toBe('tr')
  })

  it('onam verilmediyse hiçbir onam alanı üretilmez (kolonlar null kalır)', () => {
    const fields = buildConsentFields({ ...base, consentGiven: false })
    expect(fields).toEqual({})
  })
})
