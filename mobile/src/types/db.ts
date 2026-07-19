// Kaynak: /src/types/db.ts (web) — Metro repo-kökü dışı import kısıtı nedeniyle
// yalnız mobil ekranların kullandığı satır tipleri kopyalandı.
import type { RequestStatus } from '@/domain/status'

export type Decision = 'accept' | 'reject'
export type SaleStatus = 'not_completed' | 'sale_done' | 'operation_done'

export interface RequestRow {
  id: string
  tenant_id: string
  patient_id: string
  created_by: string
  category_id: string
  subcategory_id: string | null
  operation_type_id: string | null
  notes: string | null
  status: RequestStatus
  sale_status: SaleStatus
  created_at: string
  submitted_at: string | null
  assigned_at: string | null
  age: number | null
  weight_kg: number | null
  height_cm: number | null
  gender: 'female' | 'male' | 'other' | null
  past_surgeries: string
  known_conditions: string
  medications: string
}

export interface PhotoRow {
  id: string
  request_id: string
  storage_path: string
  uploaded_at: string
  layer: 'active' | 'archive'
  kind: 'photo' | 'xray'
  deleted_at?: string | null
}

export interface AssignmentRow {
  id: string
  request_id: string
  doctor_id: string
  type: 'simultaneous' | 'manual'
  assigned_at: string
  seen_at: string | null
}

export interface ResponseRow {
  id: string
  request_id: string
  doctor_id: string
  decision: Decision
  reject_reason: string | null
  treatment_plan: string | null
  responded_at: string
}

export interface AiEvaluationRow {
  id: string
  tenant_id: string
  request_id: string
  status: 'ok' | 'warning' | 'failed'
  warnings: { type: string; confidence: number; rationale: string }[]
  suitability_note: string | null
  disclaimer: string
  model: string
  model_version: string | null
  error: string | null
  created_at: string
}

export interface AiFeedbackRow {
  id: string
  tenant_id: string
  request_id: string
  ai_evaluation_id: string
  doctor_id: string
  label: 'correct' | 'partial' | 'wrong'
  note: string | null
  created_at: string
}
