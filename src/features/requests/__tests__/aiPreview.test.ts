import { describe, it, expect } from 'vitest'
import { shouldShowAiPreview } from '../aiPreview'

describe('shouldShowAiPreview', () => {
  const base = { routed: 'doctors' as const, assignedCount: 2, consentGiven: true, role: 'sales' }

  it('doktora gitti + atandı + onam + sales → gösterilir', () => {
    expect(shouldShowAiPreview(base)).toBe(true)
  })

  it('coordinator/admin da AI okuyabildiği için gösterilir', () => {
    expect(shouldShowAiPreview({ ...base, role: 'coordinator' })).toBe(true)
    expect(shouldShowAiPreview({ ...base, role: 'admin' })).toBe(true)
  })

  it('AGENT (aracı) ai_evaluation okuyamaz → gösterilmez', () => {
    expect(shouldShowAiPreview({ ...base, role: 'agent' })).toBe(false)
  })

  it('mükerrer → koordinatöre gitti: AI çalışmaz, gösterilmez (token tasarrufu)', () => {
    expect(shouldShowAiPreview({ ...base, routed: 'coordinator' })).toBe(false)
  })

  it('onam yok → AI hiç çalışmaz, gösterilmez', () => {
    expect(shouldShowAiPreview({ ...base, consentGiven: false })).toBe(false)
  })

  it('hiç doktora atanmadı → gösterilmez', () => {
    expect(shouldShowAiPreview({ ...base, assignedCount: 0 })).toBe(false)
  })

  it('rol yok/tanımsız → gösterilmez', () => {
    expect(shouldShowAiPreview({ ...base, role: null })).toBe(false)
    expect(shouldShowAiPreview({ ...base, role: undefined })).toBe(false)
  })
})
