import type { Role, RequestStatus, SaleStatus, Decision } from './domain'

export interface AppUserRow { id: string; tenant_id: string; role: Role; full_name: string; phone: string | null; is_active: boolean }
export interface CategoryRow { id: string; tenant_id: string; name: string; has_subcategories: boolean }
export interface SubcategoryRow { id: string; category_id: string; name: string }
export interface OperationTypeRow { id: string; category_id: string; subcategory_id: string | null; name: string }
export interface DoctorRow { id: string; tenant_id: string; app_user_id: string | null; photo_url: string | null; title: string | null; specialty: string | null; category_id: string; subcategory_id: string | null; bio: string | null; weighted_work: unknown; score: number; is_active: boolean }
export interface PatientRow { id: string; tenant_id: string; first_name: string; last_name: string; phone: string | null; email: string | null }
export interface RequestRow { id: string; tenant_id: string; patient_id: string; created_by: string; category_id: string; subcategory_id: string | null; operation_type_id: string | null; notes: string | null; status: RequestStatus; sale_status: SaleStatus; created_at: string; submitted_at: string | null; assigned_at: string | null; age: number | null; weight_kg: number | null; height_cm: number | null; gender: 'female' | 'male' | 'other' | null; past_surgeries: string; known_conditions: string; medications: string }
export interface PhotoRow { id: string; request_id: string; storage_path: string; uploaded_at: string; layer: 'active' | 'archive'; kind: 'photo' | 'xray' }
export interface AssignmentRow { id: string; request_id: string; doctor_id: string; type: 'simultaneous' | 'manual'; assigned_at: string; seen_at: string | null }
export interface ResponseRow { id: string; request_id: string; doctor_id: string; decision: Decision; reject_reason: string | null; treatment_plan: string | null; responded_at: string }
export interface DoctorScopeRow { id: string; tenant_id: string; doctor_id: string; category_id: string; subcategory_id: string | null }
