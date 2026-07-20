import { STATUS_LABELS, STATUS_ROLE, DECISION_LABELS, DECISION_ROLE } from '../status'

const ROLES = ['success', 'warning', 'danger', 'info', 'neutral', 'brand']

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

describe('STATUS_ROLE', () => {
  it('her durum için geçerli semantik rol tanımlı', () => {
    for (const status of Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]) {
      expect(ROLES).toContain(STATUS_ROLE[status])
    }
  })
})

describe('DECISION_LABELS', () => {
  it('kabul/red için Türkçe etiket döner', () => {
    expect(DECISION_LABELS.accept).toBe('Kabul')
    expect(DECISION_LABELS.reject).toBe('Red')
  })
})

describe('DECISION_ROLE', () => {
  it('her karar için geçerli semantik rol tanımlı', () => {
    for (const decision of Object.keys(DECISION_LABELS) as (keyof typeof DECISION_LABELS)[]) {
      expect(ROLES).toContain(DECISION_ROLE[decision])
    }
  })
})
