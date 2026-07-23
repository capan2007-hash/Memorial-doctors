import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Button as ShadButton } from '@/components/shadcn/button'
import { Field } from '../../components/ui/Field'
import { Input } from '@/components/shadcn/input'

/** Rafine marka işareti — geometrik teal haç + nokta. */
function Monogram() {
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-card bg-brand-on/10">
      <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M12 4.5v15M4.5 12h15" strokeWidth={2.25} strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.25" fill="currentColor" stroke="none" opacity={0.9} />
      </svg>
    </span>
  )
}

export function LoginPage() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // "Şifremi unuttum" modu (Faz 2 — SMTP yapılandırılınca e-posta gider).
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetInfo, setResetInfo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await signIn(email, pw)
    if (error) {
      setErr('Giriş başarısız: ' + error)
      setSubmitting(false)
    } else {
      nav('/')
    }
  }

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset',
    })
    setSubmitting(false)
    // Kullanıcı sayımı sızdırmamak için nötr mesaj (hesap var/yok belli olmaz).
    setResetInfo('Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.')
  }

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-4 bg-brand-fill px-6 py-12 text-brand-on md:py-0">
        <Monogram />
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">MedTriage</h1>
        <p className="max-w-xs text-center text-brand-on/80">Estetik cerrahi talep yönetimi &amp; triyaj</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm md:p-8">
          {mode === 'login' ? (
            <>
              <h2 className="mb-1 font-display text-xl text-foreground">Giriş</h2>
              <p className="mb-5 text-sm text-muted-foreground">Devam etmek için hesabınıza giriş yapın</p>
              <form onSubmit={submit} className="space-y-4">
                <Field label="E-posta">
                  <Input placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
                </Field>
                <Field label="Şifre" error={err ?? undefined}>
                  <Input placeholder="Şifre" value={pw} onChange={(e) => setPw(e.target.value)} type="password" autoComplete="current-password" />
                </Field>
                <Button type="submit" variant="primary" loading={submitting} className="w-full">
                  Giriş
                </Button>
              </form>
              <ShadButton
                variant="link"
                type="button"
                className="mt-3 h-auto p-0 text-sm"
                onClick={() => {
                  setMode('reset')
                  setErr(null)
                  setResetInfo(null)
                }}
              >
                Şifremi unuttum?
              </ShadButton>
            </>
          ) : (
            <>
              <h2 className="mb-1 font-display text-xl text-foreground">Şifre sıfırla</h2>
              <p className="mb-5 text-sm text-muted-foreground">Kayıtlı e-postanıza sıfırlama bağlantısı gönderelim</p>
              {resetInfo ? (
                <p className="text-sm text-success-text">{resetInfo}</p>
              ) : (
                <form onSubmit={submitReset} className="space-y-4">
                  <Field label="E-posta">
                    <Input placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
                  </Field>
                  <Button type="submit" variant="primary" loading={submitting} className="w-full">
                    Sıfırlama bağlantısı gönder
                  </Button>
                </form>
              )}
              <ShadButton
                variant="link"
                type="button"
                className="mt-3 h-auto p-0 text-sm"
                onClick={() => {
                  setMode('login')
                  setResetInfo(null)
                }}
              >
                ← Girişe dön
              </ShadButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
