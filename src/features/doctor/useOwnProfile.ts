import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useMyDoctorId } from './useMyDoctorId'
import type { DoctorRow, DoctorScopeRow } from '../../types/db'
import type { DoctorScope, WeightedWork } from '../admin/useDoctors'

export interface OwnDoctor {
  doctor: DoctorRow
  scopes: DoctorScope[]
}

/** Doktorun kendi doctor satırı + kendi yetkinlik (doctor_scope) satırları. RLS kendi kaydına sınırlar. */
export function useOwnDoctor() {
  const myId = useMyDoctorId()
  const doctorId = myId.data ?? null
  return useQuery({
    queryKey: ['own-doctor', doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<OwnDoctor> => {
      const { data: doctor, error: dErr } = await supabase
        .from('doctor').select('*').eq('id', doctorId!).single()
      if (dErr) throw dErr
      const { data: scopes, error: sErr } = await supabase
        .from('doctor_scope').select('*').eq('doctor_id', doctorId!)
      if (sErr) throw sErr
      return {
        doctor: doctor as DoctorRow,
        scopes: ((scopes ?? []) as DoctorScopeRow[]).map((s) => ({
          categoryId: s.category_id,
          subcategoryId: s.subcategory_id,
        })),
      }
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
  const myId = useMyDoctorId()
  const doctorId = myId.data ?? null
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

export interface UpdateOwnProfileInput {
  title: string | null
  specialty: string | null
  bio: string | null
  weightedWork: WeightedWork | null
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
        p_weighted_work: input.weightedWork,
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
