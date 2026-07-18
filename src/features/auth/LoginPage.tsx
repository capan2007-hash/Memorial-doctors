import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'

const INPUT_CLASSES =
  'w-full rounded-lg border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-brand-600'

function Monogram() {
  return (
    <span className="h-14 w-14 rounded-lg bg-white/15 flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
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

  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      <div className="bg-brand-700 text-white flex flex-col items-center justify-center gap-3 py-10 md:py-0 px-4">
        <Monogram />
        <h1 className="font-display text-3xl md:text-4xl font-semibold">MedTriage</h1>
        <p className="text-white/80 text-center">Estetik cerrahi talep yönetimi &amp; triyaj</p>
      </div>
      <div className="flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <h2 className="font-display text-xl mb-4">Giriş</h2>
          <form onSubmit={submit} className="space-y-3">
            <Field label="E-posta">
              <input
                className={INPUT_CLASSES}
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
            </Field>
            <Field label="Şifre" error={err ?? undefined}>
              <input
                className={INPUT_CLASSES}
                placeholder="Şifre"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                type="password"
              />
            </Field>
            <Button type="submit" variant="primary" loading={submitting} className="w-full">
              Giriş
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
