import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { AppUserRow } from '../types/db'
import type { Role } from '../types/domain'

interface AuthValue {
  session: Session | null
  appUser: AppUserRow | null
  role: Role | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}
const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [appUser, setAppUser] = useState<AppUserRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setAppUser(null); setLoading(false); return }
    supabase.from('app_user').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setAppUser(data as AppUserRow | null); setLoading(false) })
  }, [session])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }
  const signOut = async () => { await supabase.auth.signOut() }

  return <Ctx.Provider value={{ session, appUser, role: appUser?.role ?? null, loading, signIn, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth AuthProvider içinde kullanılmalı')
  return v
}
