import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

export function useMyDoctorId() {
  const { appUser } = useAuth()
  return useQuery({ queryKey: ['my-doctor', appUser?.id], enabled: !!appUser, queryFn: async () => {
    const { data } = await supabase.from('doctor').select('id').eq('app_user_id', appUser!.id).single()
    return data?.id as string | undefined
  }})
}
