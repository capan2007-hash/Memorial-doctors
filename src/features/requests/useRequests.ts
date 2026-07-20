import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadPhotos } from './usePhotoUpload'
import { resolvePhotoUrls } from './photoUrl'
import type { RequestRow, ResponseRow, PhotoRow } from '../../types/db'

interface NewRequestInput {
  tenantId: string
  createdBy: string
  patient: { first_name: string; last_name: string; phone?: string }
  /** M5: eşleşen mevcut hasta seçilmişse — hasta insert'i atlanır, telefon güncellenmez (kapsam dışı). */
  existingPatientId?: string
  /** M5 FR-44: silinmiş foto geçmişi olan hastaya bağlanınca talebe güncel foto zorunluluğu bayrağı. */
  photosRequired?: boolean
  age: number; weightKg: number; heightCm: number; gender: 'female' | 'male' | 'other'
  pastSurgeries: string; knownConditions: string; medications: string
  categoryId: string
  subcategoryId: string | null
  operationTypeId: string | null
  notes?: string
  files: File[]
  xrayFiles?: File[]
  /** P1: satışçı WhatsApp'ta onam aldığını beyan ederse true — AI ön değerlendirmesi yalnız bu durumda çalışır. */
  consentGiven?: boolean
}

export function useCreateRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewRequestInput) => {
      // 1) hasta — mevcut aday seçilmişse yeni hasta açılmaz
      let patientId = input.existingPatientId
      if (!patientId) {
        const { data: patient, error: pErr } = await supabase.from('patient')
          .insert({
            tenant_id: input.tenantId, first_name: input.patient.first_name,
            last_name: input.patient.last_name, phone: input.patient.phone,
            created_by: input.createdBy,
          })
          .select().single()
        if (pErr) throw pErr
        patientId = patient.id
      }
      // 2) talep (submitted)
      // P1: onam beyan edildiyse consent_at/consent_channel/consented_by yazılır — AI kapısı bu alana bakar.
      const consent = input.consentGiven
        ? { consent_at: new Date().toISOString(), consent_channel: 'whatsapp', consented_by: input.createdBy }
        : {}
      const { data: req, error: rErr } = await supabase.from('request').insert({
        tenant_id: input.tenantId, patient_id: patientId, created_by: input.createdBy,
        category_id: input.categoryId, subcategory_id: input.subcategoryId,
        operation_type_id: input.operationTypeId, notes: input.notes,
        age: input.age, weight_kg: input.weightKg, height_cm: input.heightCm, gender: input.gender,
        past_surgeries: input.pastSurgeries, known_conditions: input.knownConditions, medications: input.medications,
        photos_required: input.photosRequired ?? false,
        status: 'submitted', submitted_at: new Date().toISOString(),
        ...consent,
      }).select().single()
      if (rErr) throw rErr
      // 3) fotoğraflar
      if (input.files.length) await uploadPhotos(input.tenantId, req.id, input.files)
      // röntgenler
      if (input.xrayFiles?.length) await uploadPhotos(input.tenantId, req.id, input.xrayFiles, 'xray')
      // 4) Yönlendirme sunucuda (migration 0029): hastanın AÇIK başka talebi
      // telefon/isimle eşleşiyorsa mükerrer-şüphesi (pending, koordinatöre; doktora
      // atanmaz), yoksa assign_request_doctors çalışır. Atama fan-out'u yine
      // sunucu-taraflı (P0-3: client assignment INSERT edemez).
      const { data: routeRes, error: routeErr } = await supabase.rpc('route_new_request', {
        p_request_id: req.id,
      })
      if (routeErr) throw routeErr
      const routed = routeRes as { routed: 'coordinator' | 'doctors'; assignedCount?: number; parentId?: string }
      // AI görsel karşılaştırma: yalnız pending (koordinatöre) + onam varsa fire-and-forget.
      if (routed.routed === 'coordinator' && input.consentGiven) {
        void supabase.functions.invoke('duplicate-vision', { body: { requestId: req.id } }).catch(() => {})
      }
      // AI ön-triyaj: yalnız doktora giden talepte anlamlı — fire-and-forget (FR-11).
      // K5: onam verilmediyse hiç invoke edilmez (edge de savunma amaçlı reddeder).
      if (routed.routed === 'doctors' && input.consentGiven) {
        void supabase.functions.invoke('ai-triage', { body: { requestId: req.id } }).catch(() => {})
      }
      return {
        requestId: req.id as string,
        routed: routed.routed,
        assignedCount: routed.assignedCount ?? 0,
        parentId: routed.parentId,
      }
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

export interface DeletedPhotoInfo { id: string; deletedAt: string }

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
    const activePhotoRows = allPhotos.filter((p) => p.kind === 'photo' && !p.deleted_at)
    const activeXrayRows = allPhotos.filter((p) => p.kind === 'xray' && !p.deleted_at)
    const [photos, xrays] = await Promise.all([
      resolvePhotoUrls(activePhotoRows),
      resolvePhotoUrls(activeXrayRows),
    ])
    const toDeletedInfo = (rows: PhotoRow[]): DeletedPhotoInfo[] =>
      rows.filter((p) => p.deleted_at).map((p) => ({ id: p.id, deletedAt: p.deleted_at as string }))
    const deletedPhotos = toDeletedInfo(allPhotos.filter((p) => p.kind === 'photo'))
    const deletedXrays = toDeletedInfo(allPhotos.filter((p) => p.kind === 'xray'))
    // Fotoğraf yaşam döngüsü geri sayımı: hâlâ var olan (silinmemiş) en eski yükleme.
    const activeRows = allPhotos.filter((p) => !p.deleted_at)
    const oldestUploadedAt = activeRows.length
      ? activeRows.reduce((min, p) => (p.uploaded_at < min ? p.uploaded_at : min), activeRows[0].uploaded_at)
      : null
    return {
      req,
      responses: (responses ?? []) as ResponseRow[],
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
      categoryName: category?.name as string | undefined,
      subcategoryName: (subcategory?.name as string | undefined) ?? null,
      operationName: (operationType?.name as string | undefined) ?? null,
      photos,
      xrays,
      deletedPhotos,
      deletedXrays,
      oldestUploadedAt,
    }
  }})
}

interface TenantPhotoSettings { photo_retention_days: number; photo_op_buffer_days: number }

/** Satış Durumu kartındaki fotoğraf yaşam döngüsü satırı için tenant ayarları (M4). */
export function useTenantPhotoSettings(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant-photo-settings', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantPhotoSettings> => {
      const { data, error } = await supabase.from('tenant')
        .select('photo_retention_days, photo_op_buffer_days').eq('id', tenantId!).single()
      if (error) throw error
      return data as TenantPhotoSettings
    },
  })
}
