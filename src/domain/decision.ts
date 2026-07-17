import type { Decision } from '../types/domain'

export interface DoctorResponse {
  doctorId: string
  decision: Decision
}

export function aggregateStatus(
  assignedDoctorIds: string[],
  responses: DoctorResponse[],
): 'in_review' | 'offers_ready' | 'escalated' {
  const hasAccept = responses.some((r) => r.decision === 'accept')
  if (hasAccept) return 'offers_ready'
  const rejectedIds = new Set(responses.filter((r) => r.decision === 'reject').map((r) => r.doctorId))
  const allRejected = assignedDoctorIds.length > 0 && assignedDoctorIds.every((id) => rejectedIds.has(id))
  return allRejected ? 'escalated' : 'in_review'
}
