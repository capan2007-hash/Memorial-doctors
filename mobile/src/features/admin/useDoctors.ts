// Kaynak: /src/features/admin/useDoctors.ts (web) — mobil doktor yönetimi veri katmanı.
// Foto yükleme + skor geçmişi (Faz 3b) hariç mirror.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { DoctorScope } from '@/features/profile/scope'

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
  weightedWork: { items: []; note: string }
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
