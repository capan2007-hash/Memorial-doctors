import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetInfo, setResetInfo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await signIn(email, pw)
    if (error) {
      setErr(t('errors.signInFailed', { message: error }))
      setSubmitting(false)
    } else {
      nav('/')
    }
  }

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset' })
    setSubmitting(false)
    setResetInfo(t('resetInfo'))
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Sol marka paneli — gradyan + yumuşak ışık + öne çıkan değer önermesi */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -end-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.35), transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -start-16 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)' }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" aria-hidden>
              <path d="M12 4.5v15M4.5 12h15" strokeWidth={2.25} strokeLinecap="round" />
              <circle cx="12" cy="12" r="3.25" fill="currentColor" stroke="none" opacity={0.9} />
            </svg>
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">MedTriage</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            <Trans i18nKey="heroTitle" t={t}>
              Estetik cerrahi taleplerini <span className="text-white/70">saniyeler içinde</span> triyaj edin.
            </Trans>
          </h1>
          <ul className="space-y-3 text-white/85">
            <li className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-white/70" strokeWidth={1.75} /> {t('valueProps.aiTriage')}
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-white/70" strokeWidth={1.75} /> {t('valueProps.privacy')}
            </li>
          </ul>
        </div>

        <p className="relative text-sm text-white/60">{t('copyright', { year: new Date().getFullYear() })}</p>
      </div>

      {/* Sağ form paneli */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobilde marka işareti */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-fill text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden>
                <path d="M12 4.5v15M4.5 12h15" strokeWidth={2.25} strokeLinecap="round" />
                <circle cx="12" cy="12" r="3.25" fill="currentColor" stroke="none" opacity={0.9} />
              </svg>
            </span>
            <span className="font-display text-lg font-semibold">MedTriage</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-8 shadow-[0_1px_2px_rgba(20,32,29,0.04),0_12px_40px_-12px_rgba(20,32,29,0.18)]">
            {mode === 'login' ? (
              <>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t('welcomeBack')}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{t('signInSubtitle')}</p>

                <form onSubmit={submit} className="mt-7 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('email')}</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                      <Input id="email" className="h-11 ps-9" placeholder={t('emailPlaceholder')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw">{t('password')}</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                      <Input id="pw" className="h-11 ps-9" placeholder={t('passwordPlaceholder')} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
                    </div>
                    {err && <p className="text-sm font-medium text-destructive">{err}</p>}
                  </div>
                  <Button type="submit" disabled={submitting} className="group h-11 w-full text-[15px]">
                    {submitting ? t('signingIn') : t('signIn')}
                    {!submitting && <ArrowRight className="h-4 w-4 transition-transform rtl:-scale-x-100 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />}
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => { setMode('reset'); setErr(null); setResetInfo(null) }}
                  className="mt-5 text-sm font-medium text-brand-text transition-colors hover:text-brand-fill"
                >
                  {t('forgot')}
                </button>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t('resetTitle')}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{t('resetSubtitle')}</p>
                {resetInfo ? (
                  <div className="mt-6 rounded-lg border border-success-border bg-success-bg p-3 text-sm text-success-text">{resetInfo}</div>
                ) : (
                  <form onSubmit={submitReset} className="mt-7 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="remail">{t('email')}</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                        <Input id="remail" className="h-11 ps-9" placeholder={t('emailPlaceholder')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                    </div>
                    <Button type="submit" disabled={submitting} className="h-11 w-full text-[15px]">
                      {submitting ? t('sending') : t('sendResetLink')}
                    </Button>
                  </form>
                )}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setResetInfo(null) }}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-text transition-colors hover:text-brand-fill"
                >
                  {t('backToLogin')}
                </button>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t('footerNotice')}
          </p>
        </div>
      </div>
    </div>
  )
}
