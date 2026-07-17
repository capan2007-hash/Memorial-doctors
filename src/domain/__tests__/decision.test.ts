import { describe, it, expect } from 'vitest'
import { aggregateStatus, type DoctorResponse } from '../decision'

const assigned = ['d1', 'd2', 'd3']

describe('aggregateStatus', () => {
  it('en az bir kabul -> offers_ready', () => {
    const r: DoctorResponse[] = [{ doctorId: 'd1', decision: 'accept' }]
    expect(aggregateStatus(assigned, r)).toBe('offers_ready')
  })
  it('çoklu bağımsız kabul -> offers_ready', () => {
    const r: DoctorResponse[] = [
      { doctorId: 'd1', decision: 'accept' },
      { doctorId: 'd2', decision: 'accept' },
    ]
    expect(aggregateStatus(assigned, r)).toBe('offers_ready')
  })
  it('tüm atananlar red -> escalated', () => {
    const r: DoctorResponse[] = [
      { doctorId: 'd1', decision: 'reject' },
      { doctorId: 'd2', decision: 'reject' },
      { doctorId: 'd3', decision: 'reject' },
    ]
    expect(aggregateStatus(assigned, r)).toBe('escalated')
  })
  it('kısmi red, kabul yok, bekleyen var -> in_review', () => {
    const r: DoctorResponse[] = [{ doctorId: 'd1', decision: 'reject' }]
    expect(aggregateStatus(assigned, r)).toBe('in_review')
  })
  it('hiç yanıt yok -> in_review', () => {
    expect(aggregateStatus(assigned, [])).toBe('in_review')
  })
})
