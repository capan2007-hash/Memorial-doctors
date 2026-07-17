import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadPhotos } from './usePhotoUpload'
import { resolveAssignees } from '../../domain/assignment'
import type { DoctorRow, RequestRow, ResponseRow } from '../../types/db'

interface NewRequestInput {
  tenantId: string
  createdBy: string
  patient: { first_name: string; last_name: string; phone?: string; age?: number }
  categoryId: string
  subcategoryId: string | null
  operationTypeId: string | null
  notes?: string
  files: File[]
}

export function useCreateRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewRequestInput) => {
      // 1) hasta
      const { data: patient, error: pErr } = await supabase.from('patient')
        .insert({ tenant_id: input.tenantId, first_name: input.patient.first_name, last_name: input.patient.last_name, phone: input.patient.phone })
        .select().single()
      if (pErr) throw pErr
      // 2) talep (submitted)
      const { data: req, error: rErr } = await supabase.from('request').insert({
        tenant_id: input.tenantId, patient_id: patient.id, created_by: input.createdBy,
        category_id: input.categoryId, subcategory_id: input.subcategoryId,
        operation_type_id: input.operationTypeId, notes: input.notes,
        status: 'submitted', submitted_at: new Date().toISOString(),
      }).select().single()
      if (rErr) throw rErr
      // 3) fotoğraflar
      if (input.files.length) await uploadPhotos(input.tenantId, req.id, input.files)
      // 4) eşzamanlı atama
      const { data: docs } = await supabase.from('doctor').select('*').eq('category_id', input.categoryId)
      const targets = resolveAssignees(
        { categoryId: input.categoryId, subcategoryId: input.subcategoryId },
        (docs as DoctorRow[] ?? []).map((d) => ({ id: d.id, categoryId: d.category_id, subcategoryId: d.subcategory_id, isActive: d.is_active })),
      )
      if (targets.length) {
        await supabase.from('assignment').insert(
          targets.map((doctor_id) => ({ tenant_id: input.tenantId, request_id: req.id, doctor_id, type: 'simultaneous' })))
        await supabase.from('request').update({ status: 'assigned', assigned_at: new Date().toISOString() }).eq('id', req.id)
      }
      return req.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

export function useMyRequests() {
  return useQuery({ queryKey: ['requests'], queryFn: async () => {
    const { data, error } = await supabase.from('request').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data as RequestRow[]
  }})
}

export function useRequestDetail(id?: string) {
  return useQuery({ queryKey: ['request', id], enabled: !!id, queryFn: async () => {
    const { data: req } = await supabase.from('request').select('*').eq('id', id!).single()
    // response: RLS gereği agent'a boş döner; sales/coordinator/admin görür
    const { data: responses } = await supabase.from('response').select('*').eq('request_id', id!)
    return { req: req as RequestRow, responses: (responses ?? []) as ResponseRow[] }
  }})
}
