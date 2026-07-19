import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { safeExt, sanitizeImage } from '../requests/sanitizeImage'
import type { DoctorRow, DoctorScopeRow } from '../../types/db'

export interface DoctorScope { categoryId: string; subcategoryId: string | null }
export interface DoctorWithScopes extends DoctorRow { scopes: DoctorScope[] }

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
      return ((doctors ?? []) as DoctorRow[]).map((d) => ({
        ...d,
        scopes: scopeRows
          .filter((s) => s.doctor_id === d.id)
          .map((s) => ({ categoryId: s.category_id, subcategoryId: s.subcategory_id })),
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

/** Doktor profilini güncelle, yetkinlik (scope) satırlarını yeniden yaz, audit_log'a işle. */
export function useUpdateDoctor() {
  const { appUser } = useAuth()
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

      const { error: auditErr } = await supabase.from('audit_log').insert({
        tenant_id: appUser!.tenant_id, actor_id: appUser!.id, action: 'doctor_update', entity: 'doctor',
        after: { doctor_id: id },
      })
      if (auditErr) throw auditErr
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
