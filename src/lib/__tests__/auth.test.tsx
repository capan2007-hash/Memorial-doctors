import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

// supabase client mock'u: auth olaylarını elle tetikleyebilelim
type AuthCallback = (event: string, session: Session | null) => void
let authCallback: AuthCallback = () => {}
const appUserRows: Record<string, { id: string; tenant_id: string; role: string; full_name: string }> = {
  'u1': { id: 'u1', tenant_id: 't1', role: 'sales', full_name: 'Satış Bir' },
  'u2': { id: 'u2', tenant_id: 't1', role: 'doctor', full_name: 'Doktor İki' },
}
const makeSession = (userId: string) =>
  ({ user: { id: userId }, access_token: 'tok-' + Math.random() }) as unknown as Session

let initialSession: Session | null = null
let appUserFetchCount = 0

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: initialSession } }),
      onAuthStateChange: (cb: AuthCallback) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signInWithPassword: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve(),
    },
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          single: () => {
            appUserFetchCount++
            return Promise.resolve({ data: appUserRows[id] ?? null })
          },
        }),
      }),
    }),
  },
}))

import { AuthProvider, useAuth } from '../auth'

function Probe() {
  const { loading, appUser } = useAuth()
  return <div data-testid="probe">loading:{String(loading)};user:{appUser?.full_name ?? 'yok'}</div>
}

beforeEach(() => {
  initialSession = null
  appUserFetchCount = 0
})

describe('AuthProvider — oturum olayları', () => {
  it('aynı kullanıcının TOKEN_REFRESHED olayı loading tetiklemez (form unmount olmaz)', async () => {
    initialSession = makeSession('u1')
    render(<AuthProvider><Probe /></AuthProvider>)
    // ilk yükleme tamamlanır
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('loading:false;user:Satış Bir'))
    const fetchesAfterLoad = appUserFetchCount

    // sekme dönüşünü simüle et: aynı kullanıcı, YENİ session objesi
    act(() => { authCallback('TOKEN_REFRESHED', makeSession('u1')) })

    // loading ASLA true'ya dönmemeli (Protected çocukları unmount etmesin)
    expect(screen.getByTestId('probe').textContent).toBe('loading:false;user:Satış Bir')
    // ve gereksiz app_user fetch'i olmamalı
    expect(appUserFetchCount).toBe(fetchesAfterLoad)
  })

  it('gerçek kullanıcı değişiminde yeniden yükler (rol güncellenir)', async () => {
    initialSession = makeSession('u1')
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('loading:false;user:Satış Bir'))

    // farklı kullanıcıya geçiş
    act(() => { authCallback('SIGNED_IN', makeSession('u2')) })
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('loading:false;user:Doktor İki'))
  })

  it('çıkışta appUser temizlenir', async () => {
    initialSession = makeSession('u1')
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('loading:false;user:Satış Bir'))

    act(() => { authCallback('SIGNED_OUT', null) })
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('loading:false;user:yok'))
  })
})
