import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

export function useMyDoctorId() {
  const { appUser, role } = useAuth()
  return useQuery({
    // Yalnız doktor rolünde sorgula: diğer rollerde doctor satırı yoktur ve
    // TanStack Query queryFn'in undefined döndürmesini hata sayar.
    queryKey: ['my-doctor', appUser?.id],
    enabled: !!appUser && role === 'doctor',
    queryFn: async () => {
      const { data } = await supabase.from('doctor').select('id').eq('app_user_id', appUser!.id).single()
      return (data?.id as string | undefined) ?? null
    },
  })
}
