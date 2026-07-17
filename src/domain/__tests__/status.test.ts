import { describe, it, expect } from 'vitest'
import { nextStatus } from '../status'

describe('nextStatus', () => {
  it('submit: draft -> submitted', () => {
    expect(nextStatus('draft', 'submit')).toBe('submitted')
  })
  it('assign: submitted -> assigned', () => {
    expect(nextStatus('submitted', 'assign')).toBe('assigned')
  })
  it('seen: assigned -> in_review', () => {
    expect(nextStatus('assigned', 'seen')).toBe('in_review')
  })
  it('accept: in_review -> offers_ready', () => {
    expect(nextStatus('in_review', 'accept')).toBe('offers_ready')
  })
  it('accept: assigned -> offers_ready (görülmeden direkt kabul)', () => {
    expect(nextStatus('assigned', 'accept')).toBe('offers_ready')
  })
  it('reject_all: in_review -> escalated', () => {
    expect(nextStatus('in_review', 'reject_all')).toBe('escalated')
  })
  it('close: offers_ready -> closed', () => {
    expect(nextStatus('offers_ready', 'close')).toBe('closed')
  })
  it('geçersiz geçiş mevcut durumu korur', () => {
    expect(nextStatus('closed', 'assign')).toBe('closed')
  })
  it('offers_ready üstüne yeni kabul offers_ready kalır', () => {
    expect(nextStatus('offers_ready', 'accept')).toBe('offers_ready')
  })
})
