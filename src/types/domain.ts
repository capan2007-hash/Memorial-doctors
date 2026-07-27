export type Role = 'agent' | 'sales' | 'doctor' | 'coordinator' | 'admin' | 'super_admin'
export type RequestStatus =
  | 'draft' | 'submitted' | 'assigned' | 'in_review'
  | 'offers_ready' | 'escalated' | 'closed'
export type RequestEvent =
  | 'submit' | 'assign' | 'seen' | 'accept' | 'reject_all' | 'close'
export type Decision = 'accept' | 'reject'
export type SaleStatus = 'not_completed' | 'offer_sent' | 'sale_done' | 'operation_done'
