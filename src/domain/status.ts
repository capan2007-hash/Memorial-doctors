import type { RequestStatus, RequestEvent } from '../types/domain'

const TRANSITIONS: Record<RequestStatus, Partial<Record<RequestEvent, RequestStatus>>> = {
  draft:        { submit: 'submitted' },
  submitted:    { assign: 'assigned' },
  assigned:     { seen: 'in_review', accept: 'offers_ready', reject_all: 'escalated' },
  in_review:    { accept: 'offers_ready', reject_all: 'escalated' },
  offers_ready: { accept: 'offers_ready', close: 'closed' },
  escalated:    { close: 'closed' },
  closed:       {},
}

export function nextStatus(current: RequestStatus, event: RequestEvent): RequestStatus {
  return TRANSITIONS[current]?.[event] ?? current
}
