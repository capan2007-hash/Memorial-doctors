// Kaynak: /src/features/admin/useDoctors.ts (web) — mobil doktor yönetimi veri katmanı.
// Foto yükleme + skor geçmişi (Faz 3b) hariç mirror.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decode } from 'base64-arraybuffer'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { DoctorScope } from '@/features/profile/scope'

export type WeightedWorkLevel = 'high' | 'medium' | 'low'
export interface WeightedWorkItem {
  area: string
  level: WeightedWorkLevel
}
export interface WeightedWork {
  items: WeightedWorkItem[]
  note: string
}
export const emptyWeightedWork: WeightedWork = { items: [], note: '' }

/** doctor.weighted_work (jsonb) her zaman { items, note } gelmeyebilir (eski `[]` default) — güvenle normalize et. */
export function toWeightedWork(raw: unknown): WeightedWork {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as WeightedWork).items)) {
    const w = raw as WeightedWork
    return { items: w.items, note: w.note ?? '' }
  }
  return emptyWeightedWork
}

export interface DoctorRow {
  id: string
  tenant_id: string
  app_user_id: string | null
  photo_url: string | null
  title: string | null
  specialty: string | null
  category_id: string
  subcategory_id: string | null
  bio: string | null
  weighted_work: unknown
  score: number
  is_active: boolean
}

interface DoctorScopeRow {
  doctor_id: string
  category_id: string
  subcategory_id: string | null
}

export interface DoctorWithScopes extends DoctorRow {
  scopes: DoctorScope[]
}

/** Doktorları tenant kapsamında, doctor_scope satırlarıyla grupla. */
export function useDoctorsFull() {
  const { tenantId } = useAuth()
  return useQuery({
    queryKey: ['doctors'],
    enabled: !!tenantId,
    queryFn: async (): Promise<DoctorWithScopes[]> => {
      const { data: doctors, error: dErr } = await supabase
        .from('doctor')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('title')
      if (dErr) throw dErr
      const { data: scopes, error: sErr } = await supabase
        .from('doctor_scope')
        .select('doctor_id, category_id, subcategory_id')
        .eq('tenant_id', tenantId!)
      if (sErr) throw sErr
      const scopeRows = (scopes ?? []) as DoctorScopeRow[]
      return ((doctors ?? []) as DoctorRow[]).map((d) => ({
        ...d,
        scopes: scopeRows
          .filter((s) => s.doctor_id === d.id)
          .map((s) => ({ categoryId: s.category_id, subcategoryId: s.subcategory_id })),
      }))
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

/** Koordinatör/admin için doktor performans özeti (doctor_performance_summary RPC). */
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

export interface UpdateDoctorInput {
  id: string
  title?: string | null
  specialty?: string | null
  bio?: string | null
  isActive?: boolean
  weightedWork?: WeightedWork
  photoUrl?: string | null
  scopes: DoctorScope[]
}

/** Doktor profilini güncelle + yetkinlik (scope) satırlarını yeniden yaz (set_doctor_scopes). */
export function useUpdateDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateDoctorInput) => {
      const { id, scopes, ...rest } = input
      const update: Record<string, unknown> = {}
      if (rest.title !== undefined) update.title = rest.title
      if (rest.specialty !== undefined) update.specialty = rest.specialty
      if (rest.bio !== undefined) update.bio = rest.bio
      if (rest.isActive !== undefined) update.is_active = rest.isActive
      if (rest.weightedWork !== undefined) update.weighted_work = rest.weightedWork
      if (rest.photoUrl !== undefined) update.photo_url = rest.photoUrl
      if (Object.keys(update).length) {
        const { error } = await supabase.from('doctor').update(update).eq('id', id)
        if (error) throw error
      }
      const { error: scopeErr } = await supabase.rpc('set_doctor_scopes', { p_doctor_id: id, p_scopes: scopes })
      if (scopeErr) throw scopeErr
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

/** Yeni doktor kullanıcısı + doctor satırı (create-doctor edge function). */
export function useCreateDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateDoctorInput) => {
      const { data, error } = await supabase.functions.invoke('create-doctor', { body: input })
      if (error) throw error
      return data as { doctorId?: string } | null
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })
}

export interface ScoreEventRow {
  id: string
  delta: number
  reason: 'timely_response' | 'sla_breach'
  created_at: string
}

/** Doktorun skor olayları (score_event) — en yeni → eski. */
export function useScoreEvents(doctorId?: string) {
  return useQuery({
    queryKey: ['score-events', doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<ScoreEventRow[]> => {
      const { data, error } = await supabase
        .from('score_event')
        .select('id, delta, reason, created_at')
        .eq('doctor_id', doctorId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ScoreEventRow[]
    },
  })
}

function randomId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`
}

/**
 * Galeriden foto seç → yeniden kodla (resize + jpeg, EXIF düşer) → tenant-scoped
 * storage yoluna yükle; storage_path döner. Kullanıcı iptal ederse null.
 * i18n: doctors.photo.* (Faz M1 Task 6) — bu bir hook olmadığı için `t` çağıran taraftan alınır.
 */
export async function pickAndUploadDoctorPhoto(
  tenantId: string,
  doctorId: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) throw new Error(t('photo.galleryPermissionRequired'))
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  })
  if (res.canceled || !res.assets?.length) return null
  const manip = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 1024 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  })
  if (!manip.base64) throw new Error(t('photo.processingFailed'))
  const path = `${tenantId}/doctors/${doctorId}/${randomId()}.jpg`
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, decode(manip.base64), { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  return path
}

/** Depoda saklanan yoldan 5 dk geçerli imzalı görüntüleme URL'i üretir. */
export async function signDoctorPhoto(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('photos').createSignedUrl(storagePath, 300)
  if (error) throw error
  return data?.signedUrl ?? null
}
