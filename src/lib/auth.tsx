import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { clearDraft } from '../features/requests/requestDraft'
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
  // Yüklü app_user'ın kimliği. Sekmeye dönüşte supabase TOKEN_REFRESHED ile
  // AYNI kullanıcı için yeni bir session objesi verir; bunu hesap değişimi
  // sanıp loading'i tetiklemek Protected altındaki tüm ağacı unmount edip
  // form state'ini siliyordu. Aynı kullanıcıysa yeniden yükleme yapmayız.
  const loadedUserId = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      // Oturum kapandı: hasta PII taşıyan form taslağını da temizle —
      // modül-düzeyi taslak aksi halde ortak cihazda sonraki kullanıcıya sızar.
      clearDraft()
      loadedUserId.current = null; setAppUser(null); setLoading(false); return
    }
    if (loadedUserId.current !== null && loadedUserId.current !== session.user.id) {
      // Farklı kullanıcıya geçiş: önceki kullanıcının taslağı görünmesin.
      clearDraft()
    }
    if (loadedUserId.current === session.user.id) return // token yenileme: kullanıcı değişmedi
    let cancelled = false
    setLoading(true)
    supabase.from('app_user').select('*').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (!cancelled) {
          loadedUserId.current = session.user.id
          setAppUser(data as AppUserRow | null)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
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
