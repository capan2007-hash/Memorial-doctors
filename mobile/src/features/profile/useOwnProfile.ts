// Kaynak: /src/features/doctor/useOwnProfile.ts (web) — aynı RPC'ler mobilde
// mirror edilir. Fark: mobil doctorId'yi useAuth()'tan alır (web useMyDoctorId).
// RLS gereği doktor yalnız kendi doctor + doctor_scope satırlarını okur/yazar.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { DoctorScope } from './scope'

export { hasScope, toggleScope } from './scope'
export type { DoctorScope } from './scope'

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
  hospital_id?: string | null
}

interface DoctorScopeRow {
  category_id: string
  subcategory_id: string | null
}

export interface CategoryRow {
  id: string
  tenant_id: string
  name: string
  name_i18n?: Record<string, string> | null
  has_subcategories: boolean
}

export interface SubcategoryRow {
  id: string
  category_id: string
  name: string
  name_i18n?: Record<string, string> | null
}

export interface OwnDoctor {
  doctor: DoctorRow
  scopes: DoctorScope[]
  /** Doktorun bağlı olduğu hastane adı (koordinatör/admin tarafından atanır; doktor değiştiremez). */
  hospitalName: string | null
}

/** Doktorun kendi doctor satırı + kendi yetkinlik (doctor_scope) satırları. */
export function useOwnDoctor() {
  const { doctorId } = useAuth()
  return useQuery({
    queryKey: ['own-doctor', doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<OwnDoctor> => {
      const { data: doctor, error: dErr } = await supabase
        .from('doctor')
        .select('*')
        .eq('id', doctorId!)
        .single()
      if (dErr) throw dErr
      const { data: scopes, error: sErr } = await supabase
        .from('doctor_scope')
        .select('category_id, subcategory_id')
        .eq('doctor_id', doctorId!)
      if (sErr) throw sErr

      // Hastane adı: doctor.hospital_id → hospital.name (tenant_read_hospital ile okunur).
      const hospitalId = (doctor as DoctorRow).hospital_id ?? null
      let hospitalName: string | null = null
      if (hospitalId) {
        const { data: h } = await supabase.from('hospital').select('name').eq('id', hospitalId).maybeSingle()
        hospitalName = (h as { name: string } | null)?.name ?? null
      }

      return {
        doctor: doctor as DoctorRow,
        hospitalName,
        scopes: ((scopes ?? []) as DoctorScopeRow[]).map((s) => ({
          categoryId: s.category_id,
          subcategoryId: s.subcategory_id,
        })),
      }
    },
  })
}

/** Kategoriler (alt kırılım seçimi için has_subcategories dahil). */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase.from('category').select('*').order('name')
      if (error) throw error
      return (data ?? []) as CategoryRow[]
    },
  })
}

/** Bir kategorinin alt kırılımları — yalnız has_subcategories olan kategoriler için sorgulanır. */
export function useSubcategories(categoryId?: string) {
  return useQuery({
    queryKey: ['subcategories', categoryId],
    enabled: !!categoryId,
    queryFn: async (): Promise<SubcategoryRow[]> => {
      const { data, error } = await supabase
        .from('subcategory')
        .select('id, category_id, name, name_i18n')
        .eq('category_id', categoryId!)
        .order('name')
      if (error) throw error
      return (data ?? []) as SubcategoryRow[]
    },
  })
}

export interface OwnPerformance {
  doctor_id: string
  score: number
  accept_count: number
  reject_count: number
  avg_response_mins: number | null
  timely_count: number
  breach_count: number
  pending_count: number
}

/** Doktorun kendi performans özeti (own_doctor_performance RPC — tek satır). */
export function useOwnPerformance() {
  const { doctorId } = useAuth()
  return useQuery({
    queryKey: ['own-performance', doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<OwnPerformance | null> => {
      const { data, error } = await supabase.rpc('own_doctor_performance')
      if (error) throw error
      const rows = (data ?? []) as OwnPerformance[]
      return rows[0] ?? null
    },
  })
}

export interface OwnRanks {
  score_rank: number | null
  score_total: number
  score_pct: number | null
  response_rank: number | null
  response_total: number
  response_pct: number | null
}

/** Doktorun aynı klinikteki aktif doktorlar arasında puan + yanıt hızı sırası (own_doctor_ranks RPC). */
export function useOwnRanks() {
  const { doctorId } = useAuth()
  return useQuery({
    queryKey: ['own-ranks', doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<OwnRanks | null> => {
      const { data, error } = await supabase.rpc('own_doctor_ranks')
      if (error) throw error
      const rows = (data ?? []) as OwnRanks[]
      return rows[0] ?? null
    },
  })
}

export interface UpdateOwnProfileInput {
  title: string | null
  specialty: string | null
  bio: string | null
  weightedWork: unknown
  photoUrl: string | null
}

/** Doktorun kendi profil alanlarını günceller (whitelist'li SECURITY DEFINER RPC). Skor/aktiflik korunur. */
export function useUpdateOwnProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateOwnProfileInput) => {
      const { error } = await supabase.rpc('update_own_doctor_profile', {
        p_title: input.title,
        p_specialty: input.specialty,
        p_bio: input.bio,
        p_weighted_work: input.weightedWork ?? null,
        p_photo_url: input.photoUrl,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['own-doctor'] }),
  })
}

/** Doktorun kendi yetkinliklerini (doctor_scope) yeniden yazar; en az bir scope zorunlu (RPC doğrular). */
export function useSetOwnScopes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scopes: DoctorScope[]) => {
      const { error } = await supabase.rpc('set_own_doctor_scopes', { p_scopes: scopes })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['own-doctor'] }),
  })
}
