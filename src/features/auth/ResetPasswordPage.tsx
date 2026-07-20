import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'

const INPUT_CLASSES =
  'w-full rounded-control border border-line bg-surface-1 p-2 text-ink-primary placeholder:text-ink-muted transition-colors duration-[var(--dur-fast)] ease-premium focus:outline-none focus:border-brand-fill focus:ring-2 focus:ring-brand-fill/20'

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

/**
 * Şifre sıfırlama hedef sayfası (public /reset). E-postadaki bağlantı buraya döner;
 * Supabase URL'deki recovery token'ından PASSWORD_RECOVERY oturumu kurar. Kullanıcı
 * yeni şifresini girer → updateUser. SMTP yapılandırılmadan e-posta gitmez ama sayfa
 * hazırdır (Faz 2).
 */
export function ResetPasswordPage() {
  const nav = useNavigate()
  const [ready, setReady] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Supabase, sayfa yüklenince URL'deki recovery token'ını işleyip PASSWORD_RECOVERY olayını tetikler.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // Zaten kurulmuş bir oturum (recovery) varsa da forma izin ver.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (pw.length < 6) { setErr('Şifre en az 6 karakter olmalı.'); return }
    if (pw !== pw2) { setErr('Şifreler eşleşmiyor.'); return }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSubmitting(false)
    if (error) { setErr('Şifre güncellenemedi: ' + error.message); return }
    setDone(true)
    setTimeout(() => nav('/login'), 1800)
  }

  return (
    <div className="min-h-screen bg-surface-0 md:grid md:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-4 bg-brand-fill px-6 py-12 text-brand-on md:py-0">
        <Monogram />
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">MedTriage</h1>
        <p className="max-w-xs text-center text-brand-on/80">Estetik cerrahi talep yönetimi &amp; triyaj</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-card border border-line bg-surface-2 p-6 shadow-card md:p-8">
          <h2 className="mb-1 font-display text-xl text-ink-primary">Yeni şifre belirle</h2>
          {done ? (
            <p className="mt-3 text-sm text-success-text">Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz…</p>
          ) : !ready ? (
            <p className="mt-3 text-sm text-ink-muted">
              Bağlantı doğrulanıyor… Bu sayfaya e-postadaki sıfırlama bağlantısından ulaşmadıysanız
              bağlantı geçersiz veya süresi dolmuş olabilir.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <Field label="Yeni şifre">
                <input className={INPUT_CLASSES} type="password" placeholder="Yeni şifre"
                  value={pw} onChange={(e) => setPw(e.target.value)} />
              </Field>
              <Field label="Yeni şifre (tekrar)" error={err ?? undefined}>
                <input className={INPUT_CLASSES} type="password" placeholder="Yeni şifre (tekrar)"
                  value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary" loading={submitting} className="w-full">
                Şifreyi güncelle
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
