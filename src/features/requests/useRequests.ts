import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadPhotos } from './usePhotoUpload'
import { resolvePhotoUrls } from './photoUrl'
import type { RequestRow, ResponseRow, PhotoRow } from '../../types/db'
import type { CatalogRef } from '../catalog/catalogName'
import { doctorLabel } from '../doctor/doctorLabel'
import { LEGAL_VERSION, resolveLang } from '../../pages/legal'

// Katalog adı lokalizasyonu render-anında `catalogName(ref, i18n.language)` ile yapılır
// (bkz. src/features/catalog/catalogName.ts) — bu yüzden queryFn ham `name`+`name_i18n`'i taşır.
export type { CatalogRef }

export interface NewRequestInput {
  tenantId: string
  createdBy: string
  patient: { first_name: string; last_name: string; phone?: string }
  /** M5: eşleşen mevcut hasta seçilmişse — hasta insert'i atlanır, telefon güncellenmez (kapsam dışı). */
  existingPatientId?: string
  /** M5 FR-44: silinmiş foto geçmişi olan hastaya bağlanınca talebe güncel foto zorunluluğu bayrağı. */
  photosRequired?: boolean
  age: number; weightKg: number; heightCm: number; gender: 'female' | 'male' | 'other'
  pastSurgeries: string; knownConditions: string; medications: string
  /** Yaşam tarzı (sigara/alkol) — cerrahi/anestezi risk girdisi. Miktar yalnız ilgili durumda dolu. */
  smokingStatus?: 'never' | 'former' | 'current' | null
  smokingCigsPerDay?: number | null
  smokingYears?: number | null
  alcoholStatus?: 'never' | 'occasional' | 'regular' | null
  alcoholDrinksPerWeek?: number | null
  categoryId: string
  /** Birincil işlem (liste/başlık/mükerrer akışı bunu kullanır) = seçilenlerin ilki. */
  subcategoryId: string | null
  /** Talepte seçilen TÜM işlemler (çoklu). Birincil dahil. */
  subcategoryIds?: string[]
  operationTypeId: string | null
  notes?: string
  /** Yönlendirme seçimi: null = tüm uygun doktorlar; dizi = yalnız seçilen doktorlar. */
  selectedDoctorIds?: string[] | null
  files: File[]
  xrayFiles?: File[]
  /** P1: satışçı WhatsApp'ta onam aldığını beyan ederse true — AI ön değerlendirmesi yalnız bu durumda çalışır. */
  consentGiven?: boolean
  /** Aydınlatma metninin hastaya iletildiği dil (onam kartı seçicisi). */
  consentLang?: string
  /** Faz 3: talebin girildiği dil (yazma-anında kaydedilir) — içerik çevirisi kaynak dili belirler. */
  sourceLang: string
}

/**
 * Onam beyan edildiyse consent_at/consent_channel/consented_by + hastaya iletilen
 * aydınlatma metninin sürümü/dili (consent_text_version/consent_lang) — AI kapısı
 * ve KVKK izlenebilirliği bu alanlara bakar. Onam yoksa boş nesne (kolonlar null kalır).
 *
 * consent_lang resolveLang ile normalize edilir: sourceLang ham i18n.language'ten
 * gelir (ör. 'tr-TR' bölge kodlu olabilir), ama migration'daki kolon yorumu
 * tr/ar/en/ru/de/fr'den birini vaat eder.
 */
export function buildConsentFields(input: Pick<NewRequestInput, 'consentGiven' | 'createdBy' | 'consentLang' | 'sourceLang'>) {
  return input.consentGiven
    ? {
        consent_at: new Date().toISOString(),
        consent_channel: 'whatsapp',
        consented_by: input.createdBy,
        consent_text_version: LEGAL_VERSION,
        consent_lang: resolveLang(input.consentLang ?? input.sourceLang),
      }
    : {}
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
      const consent = buildConsentFields(input)
      const { data: req, error: rErr } = await supabase.from('request').insert({
        tenant_id: input.tenantId, patient_id: patientId, created_by: input.createdBy,
        category_id: input.categoryId, subcategory_id: input.subcategoryId,
        operation_type_id: input.operationTypeId, notes: input.notes,
        age: input.age, weight_kg: input.weightKg, height_cm: input.heightCm, gender: input.gender,
        past_surgeries: input.pastSurgeries, known_conditions: input.knownConditions, medications: input.medications,
        smoking_status: input.smokingStatus ?? null,
        smoking_cigs_per_day: input.smokingCigsPerDay ?? null,
        smoking_years: input.smokingYears ?? null,
        alcohol_status: input.alcoholStatus ?? null,
        alcohol_drinks_per_week: input.alcoholDrinksPerWeek ?? null,
        photos_required: input.photosRequired ?? false,
        // Seçim KALICI: mükerrer akışında koordinatör onayı sonrası atama yapılırken de
        // aynı seçim kullanılır (bkz. resolve_duplicate / migration 0056).
        selected_doctor_ids: input.selectedDoctorIds ?? null,
        status: 'submitted', submitted_at: new Date().toISOString(),
        source_lang: input.sourceLang,
        ...consent,
      }).select().single()
      if (rErr) throw rErr
      // 2b) çoklu işlem seçimi (request_subcategory). Birincil zaten request'te.
      if (input.subcategoryIds?.length) {
        const { error: subErr } = await supabase.from('request_subcategory').insert(
          input.subcategoryIds.map((subcategory_id) => ({ request_id: req.id, subcategory_id })),
        )
        if (subErr) throw subErr
      }
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
      // AI tetiklemesi (ai-triage / duplicate-vision) artık SUNUCUDA: route_new_request
      // onam varsa pg_net ile ilgili edge fn'i çağırır. İstemci fire-and-forget invoke'u
      // tarayıcı navigasyonuyla iptal olabildiğinden kaldırıldı (güvenilirlik).
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

export type EnrichedRequestRow = RequestRow & { patientName: string; patientPhone: string | null; category?: CatalogRef }

export function useMyRequests() {
  return useQuery({ queryKey: ['requests'], queryFn: async (): Promise<EnrichedRequestRow[]> => {
    const { data, error } = await supabase.from('request').select('*').order('created_at', { ascending: false })
    if (error) throw error
    const requests = data as RequestRow[]
    const [{ data: patients }, { data: categories }] = await Promise.all([
      // Telefon: satışçı arama/mükerrer kontrolü için (RLS zaten satış-grubu hastasını verir).
      supabase.from('patient').select('id, first_name, last_name, phone'),
      supabase.from('category').select('id, name, name_i18n'),
    ])
    const patientMap = new Map((patients ?? []).map((p: any) => [p.id, { name: `${p.first_name} ${p.last_name}`, phone: (p.phone ?? null) as string | null }]))
    const categoryMap = new Map((categories ?? []).map((c: any) => [c.id, c as CatalogRef]))
    return requests.map((r) => ({
      ...r,
      patientName: patientMap.get(r.patient_id)?.name ?? '—',
      patientPhone: patientMap.get(r.patient_id)?.phone ?? null,
      category: categoryMap.get(r.category_id),
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
      supabase.from('category').select('name, name_i18n').eq('id', req.category_id).single(),
      req.subcategory_id
        ? supabase.from('subcategory').select('name, name_i18n').eq('id', req.subcategory_id).single()
        : Promise.resolve({ data: null }),
      req.operation_type_id
        ? supabase.from('operation_type').select('name, name_i18n').eq('id', req.operation_type_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('photo').select('*').eq('request_id', id!),
    ])

    // Çoklu işlem seçimi (katalog v2): talepte seçili TÜM alt kategoriler.
    // sort_order ile listelenir; boşsa arayüz tekil subcategory'ye düşer (eski talepler).
    const { data: procRows } = await supabase
      .from('request_subcategory')
      .select('sort_order, subcategory:subcategory_id(name, name_i18n)')
      .eq('request_id', id!)
      .order('sort_order')
    const procedures = ((procRows ?? []) as unknown as { subcategory: CatalogRef | null }[])
      .map((r) => r.subcategory)
      .filter((s): s is CatalogRef => !!s)

    // Doktor yanıtı özeti: kaç doktora gitti + yanıt verenlerin ADI.
    // RLS: assignment satış grubuna 0050 ile açıldı; doctor/app_user tenant içinde okunur.
    const responseRows = (responses ?? []) as ResponseRow[]
    const { data: assignmentRows } = await supabase
      .from('assignment').select('doctor_id').eq('request_id', id!)
    const doctorIds = Array.from(
      new Set([...(assignmentRows ?? []).map((a: { doctor_id: string }) => a.doctor_id), ...responseRows.map((r) => r.doctor_id)]),
    )
    const doctorNames = new Map<string, string>()
    if (doctorIds.length > 0) {
      const { data: docs } = await supabase
        .from('doctor').select('id, title, app_user_id').in('id', doctorIds)
      const appUserIds = (docs ?? []).map((d: { app_user_id: string | null }) => d.app_user_id).filter(Boolean) as string[]
      const { data: users } = appUserIds.length
        ? await supabase.from('app_user').select('id, full_name').in('id', appUserIds)
        : { data: [] }
      const nameByUser = new Map((users ?? []).map((u: { id: string; full_name: string | null }) => [u.id, u.full_name ?? '']))
      for (const d of docs ?? []) {
        const doc = d as { id: string; title: string | null; app_user_id: string | null }
        const full = doc.app_user_id ? nameByUser.get(doc.app_user_id) ?? '' : ''
        const label = doctorLabel(doc.title, full)
        if (label) doctorNames.set(doc.id, label)
      }
    }

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
      responses: responseRows,
      // Talep kaç doktora gitti (bekleyen sayısı = assignedCount - responses.length).
      assignedCount: (assignmentRows ?? []).length,
      // doctor_id → "Op. Dr. Ayşe Yılmaz" (yoksa arayüz kısaltılmış kimliğe düşer).
      doctorNames,
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
      category: (category as CatalogRef | null) ?? undefined,
      subcategory: (subcategory as CatalogRef | null) ?? null,
      operationType: (operationType as CatalogRef | null) ?? null,
      // Katalog v2 çoklu işlem; eski taleplerde boş dizi.
      procedures,
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
