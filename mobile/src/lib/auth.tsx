// Kaynak deseni: /src/lib/auth.tsx (web) — loadedUserId ref deseni token yenilemede
// gereksiz yeniden yüklemeyi (ve dolayısıyla ekran/route unmount'unu) önlemek için korunmuştur.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Role = 'agent' | 'sales' | 'doctor' | 'coordinator' | 'admin'

interface AppUserRow {
  id: string
  tenant_id: string
  role: Role
  full_name: string
  phone: string | null
  is_active: boolean
}

interface DoctorRow {
  id: string
  app_user_id: string | null
}

interface AuthValue {
  session: Session | null
  role: Role | null
  fullName: string | null
  tenantId: string | null
  doctorId: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [appUser, setAppUser] = useState<AppUserRow | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Yüklü app_user'ın kimliği. Sekmeye dönüşte / token yenilemede supabase
  // AYNI kullanıcı için yeni bir session objesi verir; bunu hesap değişimi
  // sanıp loading'i tetiklemek korunan ekranları unmount edip state kaybına yol açar.
  const loadedUserId = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      loadedUserId.current = null
      setAppUser(null)
      setDoctorId(null)
      setLoading(false)
      return
    }
    if (loadedUserId.current === session.user.id) return // token yenileme: kullanıcı değişmedi
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data: appUserRow } = await supabase
        .from('app_user')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (cancelled) return

      let nextDoctorId: string | null = null
      if (appUserRow?.role === 'doctor') {
        const { data: doctorRow } = await supabase
          .from('doctor')
          .select('id, app_user_id')
          .eq('app_user_id', session.user.id)
          .single()
        if (cancelled) return
        nextDoctorId = (doctorRow as DoctorRow | null)?.id ?? null
      }

      loadedUserId.current = session.user.id
      setAppUser(appUserRow as AppUserRow | null)
      setDoctorId(nextDoctorId)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [session])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }
  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <Ctx.Provider
      value={{
        session,
        role: appUser?.role ?? null,
        fullName: appUser?.full_name ?? null,
        tenantId: appUser?.tenant_id ?? null,
        doctorId,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth AuthProvider içinde kullanılmalı')
  return v
}
