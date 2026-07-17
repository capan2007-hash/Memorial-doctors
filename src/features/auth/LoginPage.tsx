import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export function LoginPage() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await signIn(email, pw)
    if (error) setErr('Giriş başarısız: ' + error)
    else nav('/')
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 bg-white p-6 rounded-xl shadow">
        <h1 className="text-xl font-semibold">MedTriage</h1>
        <input className="w-full border rounded p-2" placeholder="E-posta" value={email}
          onChange={(e) => setEmail(e.target.value)} type="email" />
        <input className="w-full border rounded p-2" placeholder="Şifre" value={pw}
          onChange={(e) => setPw(e.target.value)} type="password" />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="w-full bg-slate-800 text-white rounded p-2">Giriş</button>
      </form>
    </div>
  )
}
