import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'

export function Layout({ children }: { children: ReactNode }) {
  const { appUser, signOut } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
        <span className="font-semibold">MedTriage</span>
        <span className="text-sm">{appUser?.full_name} · <button onClick={signOut} className="underline">Çıkış</button></span>
      </header>
      <main className="max-w-3xl mx-auto p-4">{children}</main>
    </div>
  )
}
