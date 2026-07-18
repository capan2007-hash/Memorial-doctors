import { STATUS_LABELS, STATUS_COLORS, DECISION_LABELS, DECISION_COLORS } from '../status'

describe('STATUS_LABELS', () => {
  it('tüm durumlar için Türkçe etiket döner', () => {
    expect(STATUS_LABELS.draft).toBe('Taslak')
    expect(STATUS_LABELS.submitted).toBe('Gönderildi')
    expect(STATUS_LABELS.assigned).toBe('Atandı')
    expect(STATUS_LABELS.in_review).toBe('Yanıtlanıyor')
    expect(STATUS_LABELS.offers_ready).toBe('Teklif hazır')
    expect(STATUS_LABELS.escalated).toBe('Eskalasyon')
    expect(STATUS_LABELS.closed).toBe('Kapandı')
  })
})

describe('STATUS_COLORS', () => {
  it('her durum için bg/text renk çifti tanımlı', () => {
    for (const status of Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]) {
      expect(STATUS_COLORS[status]).toBeDefined()
      expect(STATUS_COLORS[status].bg).toMatch(/^#/)
      expect(STATUS_COLORS[status].text).toMatch(/^#/)
    }
  })
})

describe('DECISION_LABELS', () => {
  it('kabul/red için Türkçe etiket döner', () => {
    expect(DECISION_LABELS.accept).toBe('Kabul')
    expect(DECISION_LABELS.reject).toBe('Red')
  })
})

describe('DECISION_COLORS', () => {
  it('her karar için bg/text renk çifti tanımlı', () => {
    for (const decision of Object.keys(DECISION_LABELS) as (keyof typeof DECISION_LABELS)[]) {
      expect(DECISION_COLORS[decision]).toBeDefined()
      expect(DECISION_COLORS[decision].bg).toMatch(/^#/)
      expect(DECISION_COLORS[decision].text).toMatch(/^#/)
    }
  })
})
