import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadPhotos } from './usePhotoUpload'
import { resolveAssignees } from '../../domain/assignment'
import type { ScopedDoctor } from '../../domain/assignment'
import type { RequestRow, ResponseRow, PhotoRow } from '../../types/db'

async function signPhotoUrls(photos: PhotoRow[]) {
  const signed = await Promise.all(photos.map(async (p) => {
    const { data } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 300)
    return data?.signedUrl
  }))
  return signed.filter(Boolean) as string[]
}

interface NewRequestInput {
  tenantId: string
  createdBy: string
  patient: { first_name: string; last_name: string; phone?: string }
  age: number; weightKg: number; heightCm: number; gender: 'female' | 'male' | 'other'
  pastSurgeries: string; knownConditions: string; medications: string
  categoryId: string
  subcategoryId: string | null
  operationTypeId: string | null
  notes?: string
  files: File[]
  xrayFiles?: File[]
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
        age: input.age, weight_kg: input.weightKg, height_cm: input.heightCm, gender: input.gender,
        past_surgeries: input.pastSurgeries, known_conditions: input.knownConditions, medications: input.medications,
        status: 'submitted', submitted_at: new Date().toISOString(),
      }).select().single()
      if (rErr) throw rErr
      // 3) fotoğraflar
      if (input.files.length) await uploadPhotos(input.tenantId, req.id, input.files)
      // röntgenler
      if (input.xrayFiles?.length) await uploadPhotos(input.tenantId, req.id, input.xrayFiles, 'xray')
      // 4) eşzamanlı atama — scope tabanlı
      const { data: docs } = await supabase.from('doctor').select('id, is_active').eq('tenant_id', input.tenantId)
      const { data: scopes } = await supabase.from('doctor_scope').select('doctor_id, category_id, subcategory_id').eq('tenant_id', input.tenantId)
      const scoped: ScopedDoctor[] = (docs ?? []).map((d: any) => ({
        id: d.id, isActive: d.is_active,
        scopes: (scopes ?? []).filter((s: any) => s.doctor_id === d.id)
          .map((s: any) => ({ categoryId: s.category_id, subcategoryId: s.subcategory_id })),
      }))
      const targets = resolveAssignees({ categoryId: input.categoryId, subcategoryId: input.subcategoryId }, scoped)
      if (targets.length) {
        const { error: asgErr } = await supabase.from('assignment').insert(
          targets.map((doctor_id) => ({ tenant_id: input.tenantId, request_id: req.id, doctor_id, type: 'simultaneous' })))
        if (asgErr) throw asgErr
        const { error: updErr } = await supabase.from('request').update({ status: 'assigned', assigned_at: new Date().toISOString() }).eq('id', req.id)
        if (updErr) throw updErr
      }
      // AI ön-triyaj: fire-and-forget — FR-11 gereği akışı asla bloklamaz/hata sızdırmaz.
      void supabase.functions.invoke('ai-triage', { body: { requestId: req.id } }).catch(() => {})
      return { requestId: req.id as string, assignedCount: targets.length }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

export type EnrichedRequestRow = RequestRow & { patientName: string; categoryName: string }

export function useMyRequests() {
  return useQuery({ queryKey: ['requests'], queryFn: async (): Promise<EnrichedRequestRow[]> => {
    const { data, error } = await supabase.from('request').select('*').order('created_at', { ascending: false })
    if (error) throw error
    const requests = data as RequestRow[]
    const [{ data: patients }, { data: categories }] = await Promise.all([
      supabase.from('patient').select('id, first_name, last_name'),
      supabase.from('category').select('id, name'),
    ])
    const patientMap = new Map((patients ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]))
    const categoryMap = new Map((categories ?? []).map((c: any) => [c.id, c.name as string]))
    return requests.map((r) => ({
      ...r,
      patientName: patientMap.get(r.patient_id) ?? '—',
      categoryName: categoryMap.get(r.category_id) ?? '—',
    }))
  }})
}

export function useRequestDetail(id?: string) {
  return useQuery({ queryKey: ['request', id], enabled: !!id, queryFn: async () => {
    const { data: reqData } = await supabase.from('request').select('*').eq('id', id!).single()
    const req = reqData as RequestRow
    // response: RLS gereği agent'a boş döner; sales/coordinator/admin görür
    const [{ data: responses }, { data: patient }, { data: category }, { data: subcategory }, { data: operationType }, { data: photoRows }] = await Promise.all([
      supabase.from('response').select('*').eq('request_id', id!),
      supabase.from('patient').select('first_name, last_name').eq('id', req.patient_id).single(),
      supabase.from('category').select('name').eq('id', req.category_id).single(),
      req.subcategory_id
        ? supabase.from('subcategory').select('name').eq('id', req.subcategory_id).single()
        : Promise.resolve({ data: null }),
      req.operation_type_id
        ? supabase.from('operation_type').select('name').eq('id', req.operation_type_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('photo').select('*').eq('request_id', id!),
    ])
    const allPhotos = (photoRows ?? []) as PhotoRow[]
    const [photos, xrays] = await Promise.all([
      signPhotoUrls(allPhotos.filter((p) => p.kind === 'photo')),
      signPhotoUrls(allPhotos.filter((p) => p.kind === 'xray')),
    ])
    return {
      req,
      responses: (responses ?? []) as ResponseRow[],
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
      categoryName: category?.name as string | undefined,
      subcategoryName: (subcategory?.name as string | undefined) ?? null,
      operationName: (operationType?.name as string | undefined) ?? null,
      photos,
      xrays,
    }
  }})
}
