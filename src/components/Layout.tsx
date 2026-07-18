import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { navLinks } from '../lib/nav'

export function Layout({ children }: { children: ReactNode }) {
  const { appUser, role, signOut } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
        <span className="font-semibold">MedTriage</span>
        <nav className="flex gap-4 text-sm">
          {navLinks(role).map((l) => <Link key={l.to} to={l.to} className="hover:underline">{l.label}</Link>)}
        </nav>
        <span className="text-sm">{appUser?.full_name} · <button onClick={signOut} className="underline">Çıkış</button></span>
      </header>
      <main className="max-w-3xl mx-auto p-4">{children}</main>
    </div>
  )
}
