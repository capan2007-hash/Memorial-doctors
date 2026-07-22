// Kaynak: /src/features/admin/useUsers.ts (web) — mobil kullanıcı/doktor yönetimi.
// create-user / manage-user edge fn'leri; hata gövdesinden {error} çıkarımı.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/auth'

export interface ManagedUser {
  id: string
  full_name: string
  email: string | null
  role: Role
  is_active: boolean
  phone: string | null
}

/** Edge fn non-2xx döndüğünde gövde {error} mesajını çıkarır (UX için). */
export async function invokeUserFn(name: string, body: object): Promise<void> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> })
  if (error) {
    let msg = error.message
    try {
      const ctx = (error as unknown as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json()
        if (j?.error) msg = j.error
      }
    } catch {
      /* yut */
    }
    throw new Error(msg)
  }
  if (data && (data as { error?: string }).error) throw new Error((data as { error: string }).error)
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<ManagedUser[]> => {
      const { data, error } = await supabase
        .from('app_user')
        .select('id, full_name, email, role, is_active, phone')
        .order('full_name')
      if (error) throw error
      return (data ?? []) as ManagedUser[]
    },
  })
}

export interface CreateUserInput {
  email: string
  password: string
  fullName: string
  phone?: string
  role: Role
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput) => invokeUserFn('create-user', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export type ManageAction =
  | { userId: string; action: 'reset_password'; password: string }
  | { userId: string; action: 'set_active'; isActive: boolean }
  | { userId: string; action: 'delete_doctor' }

export function useManageUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ManageAction) => invokeUserFn('manage-user', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['doctors'] })
    },
  })
}
