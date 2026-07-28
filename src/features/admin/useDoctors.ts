import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { safeExt, sanitizeImage } from '../requests/sanitizeImage'
import type { DoctorRow, DoctorScopeRow } from '../../types/db'

export interface DoctorScope { categoryId: string; subcategoryId: string | null }
export interface DoctorWithScopes extends DoctorRow {
  scopes: DoctorScope[]
  /** app_user.full_name — doktorun ADI doctor tablosunda DEĞİL, bağlı kullanıcıda tutulur. */
  fullName: string | null
  hospitalId: string | null
  hospitalName: string | null
}

export interface HospitalRow { id: string; name: string; sort_order: number; is_active: boolean }

/** Tenant'ın hastane listesi (doktor tanımında seçilir). */
export function useHospitals() {
  const { appUser } = useAuth()
  return useQuery({
    queryKey: ['hospitals'],
    enabled: !!appUser?.tenant_id,
    queryFn: async (): Promise<HospitalRow[]> => {
      const { data, error } = await supabase
        .from('hospital').select('id, name, sort_order, is_active')
        .eq('tenant_id', appUser!.tenant_id).eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as HospitalRow[]
    },
  })
}

export type WeightedWorkLevel = 'high' | 'medium' | 'low'
export interface WeightedWorkItem { area: string; level: WeightedWorkLevel }
export interface WeightedWork { items: WeightedWorkItem[]; note: string }

export const emptyWeightedWork: WeightedWork = { items: [], note: '' }

/** doctor.weighted_work (jsonb) her zaman { items, note } şeklinde gelmeyebilir (ör. eski `[]` default) — güvenle normalize et. */
export function toWeightedWork(raw: unknown): WeightedWork {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as WeightedWork).items)) {
    const w = raw as WeightedWork
    return { items: w.items, note: w.note ?? '' }
  }
  return emptyWeightedWork
}

/** Doktorları tenant kapsamında, doctor_scope satırlarıyla birlikte grupla. */
export function useDoctorsFull() {
  const { appUser } = useAuth()
  return useQuery({
    queryKey: ['doctors'],
    enabled: !!appUser?.tenant_id,
    queryFn: async () => {
      const { data: doctors, error: dErr } = await supabase
        .from('doctor').select('*').eq('tenant_id', appUser!.tenant_id).order('title')
      if (dErr) throw dErr
      const { data: scopes, error: sErr } = await supabase
        .from('doctor_scope').select('*').eq('tenant_id', appUser!.tenant_id)
      if (sErr) throw sErr
      const scopeRows = (scopes ?? []) as DoctorScopeRow[]
      const doctorRows = (doctors ?? []) as DoctorRow[]

      // Ad app_user'da, hastane adı hospital tablosunda — ikisini de tek seferde çöz.
      const appUserIds = doctorRows.map((d) => d.app_user_id).filter(Boolean) as string[]
      const hospitalIds = Array.from(new Set(doctorRows.map((d) => d.hospital_id).filter(Boolean))) as string[]
      const [{ data: users }, { data: hospitals }] = await Promise.all([
        appUserIds.length
          ? supabase.from('app_user').select('id, full_name').in('id', appUserIds)
          : Promise.resolve({ data: [] }),
        hospitalIds.length
          ? supabase.from('hospital').select('id, name').in('id', hospitalIds)
          : Promise.resolve({ data: [] }),
      ])
      const nameByUser = new Map(
        ((users ?? []) as { id: string; full_name: string | null }[]).map((u) => [u.id, u.full_name]),
      )
      const hospitalByIdName = new Map(
        ((hospitals ?? []) as { id: string; name: string }[]).map((h) => [h.id, h.name]),
      )

      return doctorRows.map((d) => ({
        ...d,
        scopes: scopeRows
          .filter((s) => s.doctor_id === d.id)
          .map((s) => ({ categoryId: s.category_id, subcategoryId: s.subcategory_id })),
        fullName: d.app_user_id ? nameByUser.get(d.app_user_id) ?? null : null,
        hospitalId: d.hospital_id ?? null,
        hospitalName: d.hospital_id ? hospitalByIdName.get(d.hospital_id) ?? null : null,
      })) as DoctorWithScopes[]
    },
  })
}

export interface DoctorMetrics { acceptCount: number; rejectCount: number; avgResponseMins: number | null }

/** Kabul/red sayıları ve atama→yanıt arası ortalama süre (dakika). */
export function useDoctorMetrics(doctorId?: string) {
  return useQuery({
    queryKey: ['doctor-metrics', doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<DoctorMetrics> => {
      const { data: responses, error: rErr } = await supabase
        .from('response').select('request_id, decision, responded_at').eq('doctor_id', doctorId!)
      if (rErr) throw rErr
      const rows = (responses ?? []) as { request_id: string; decision: 'accept' | 'reject'; responded_at: string }[]
      const acceptCount = rows.filter((r) => r.decision === 'accept').length
      const rejectCount = rows.filter((r) => r.decision === 'reject').length

      let avgResponseMins: number | null = null
      if (rows.length) {
        const requestIds = rows.map((r) => r.request_id)
        const { data: assignments, error: aErr } = await supabase
          .from('assignment').select('request_id, assigned_at')
          .eq('doctor_id', doctorId!).in('request_id', requestIds)
        if (aErr) throw aErr
        const assignedAtByRequest = new Map(
          ((assignments ?? []) as { request_id: string; assigned_at: string }[]).map((a) => [a.request_id, a.assigned_at]),
        )
        const diffsMins: number[] = []
        for (const r of rows) {
          const assignedAt = assignedAtByRequest.get(r.request_id)
          if (!assignedAt || !r.responded_at) continue
          const mins = (new Date(r.responded_at).getTime() - new Date(assignedAt).getTime()) / 60000
          if (Number.isFinite(mins) && mins >= 0) diffsMins.push(mins)
        }
        avgResponseMins = diffsMins.length ? diffsMins.reduce((a, b) => a + b, 0) / diffsMins.length : null
      }
      return { acceptCount, rejectCount, avgResponseMins }
    },
  })
}

export interface DoctorPerformanceRow {
  doctor_id: string
  title: string | null
  specialty: string | null
  score: number
  is_active: boolean
  accept_count: number
  reject_count: number
  avg_response_mins: number | null
  timely_count: number
  breach_count: number
  pending_count: number
}

/** Koordinatör/admin için doktor performans özeti (RPC zaten tenant+role kapsamlı; sales için []). */
export function useDoctorPerformance(from?: string, to?: string) {
  return useQuery({
    queryKey: ['doctor-performance', from, to],
    queryFn: async (): Promise<DoctorPerformanceRow[]> => {
      const { data, error } = await supabase.rpc('doctor_performance_summary', {
        p_from: from ?? null,
        p_to: to ?? null,
      })
      if (error) throw error
      return (data ?? []) as DoctorPerformanceRow[]
    },
  })
}

export interface ScoreEventRow { id: string; delta: 1 | -1; reason: 'timely_response' | 'sla_breach'; created_at: string }

/** Doktorun skor olayları (score_event); from/to verilirse created_at aralığına daraltır (ISO). */
export function useScoreEvents(doctorId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['score-events', doctorId, from, to],
    enabled: !!doctorId,
    queryFn: async (): Promise<ScoreEventRow[]> => {
      let query = supabase.from('score_event').select('id, delta, reason, created_at').eq('doctor_id', doctorId!)
      if (from) query = query.gte('created_at', from)
      if (to) query = query.lte('created_at', to)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ScoreEventRow[]
    },
  })
}

export interface UpdateDoctorInput {
  id: string
  title?: string | null
  specialty?: string | null
  bio?: string | null
  weightedWork?: WeightedWork
  isActive?: boolean
  photoUrl?: string | null
  scopes: DoctorScope[]
}

/** Doktor profilini güncelle, yetkinlik (scope) satırlarını yeniden yaz; audit sunucu tarafında. */
export function useUpdateDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateDoctorInput) => {
      const { id, scopes, ...rest } = input
      const update: Record<string, unknown> = {}
      if (rest.title !== undefined) update.title = rest.title
      if (rest.specialty !== undefined) update.specialty = rest.specialty
      if (rest.bio !== undefined) update.bio = rest.bio
      if (rest.weightedWork !== undefined) update.weighted_work = rest.weightedWork
      if (rest.isActive !== undefined) update.is_active = rest.isActive
      if (rest.photoUrl !== undefined) update.photo_url = rest.photoUrl

      if (Object.keys(update).length) {
        const { error } = await supabase.from('doctor').update(update).eq('id', id)
        if (error) throw error
      }

      const { error: scopeErr } = await supabase.rpc('set_doctor_scopes', {
        p_doctor_id: id,
        p_scopes: scopes,
      })
      if (scopeErr) throw scopeErr
      // Audit sunucu tarafında (migration 0025 trg_audit_doctor_update).
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })
}

export interface UpdateDoctorIdentityInput {
  doctorId: string
  fullName: string
  title: string
  specialty: string
  hospitalId: string | null
}

/**
 * Koordinatör/admin: doktorun ADINI (app_user.full_name), unvanını, branşını ve
 * hastanesini güncelle. app_user'da UPDATE policy'si YOK — bu yüzden SECURITY DEFINER
 * RPC üzerinden gider (migration 0059).
 */
export function useUpdateDoctorIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateDoctorIdentityInput) => {
      const { error } = await supabase.rpc('admin_update_doctor_identity', {
        p_doctor_id: input.doctorId,
        p_full_name: input.fullName,
        p_title: input.title,
        p_specialty: input.specialty,
        p_hospital_id: input.hospitalId,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })
}

export interface CreateDoctorInput {
  email: string
  password: string
  fullName: string
  title: string
  specialty: string
  hospitalId?: string | null
  bio: string
  weightedWork: WeightedWork
  scopes: DoctorScope[]
}

/** Yeni doktor kullanıcısı + doctor satırı oluşturur (create-doctor edge function, Task 8). */
export function useCreateDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateDoctorInput) => {
      const { data, error } = await supabase.functions.invoke('create-doctor', { body: input })
      if (error) throw error
      return data as { doctorId?: string; doctor?: { id: string } } | null
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })
}

/** Doktor fotoğrafını tenant-scoped storage yoluna yükler, storage_path döner (doctor.photo_url'e yazılır). */
export async function uploadDoctorPhoto(tenantId: string, doctorId: string, file: File) {
  // Hasta fotoğraflarıyla aynı gizlilik deseni: dosya adı taşınmaz, EXIF düşer.
  const path = `${tenantId}/doctors/${doctorId}/${crypto.randomUUID()}.${safeExt(file)}`
  const blob = await sanitizeImage(file)
  const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: blob.type || file.type })
  if (error) throw error
  return path
}

/** Depoda saklanan yoldan 5 dk geçerli imzalı görüntüleme URL'i üretir. */
export async function signDoctorPhoto(storagePath: string) {
  const { data, error } = await supabase.storage.from('photos').createSignedUrl(storagePath, 300)
  if (error) throw error
  return data?.signedUrl ?? null
}
