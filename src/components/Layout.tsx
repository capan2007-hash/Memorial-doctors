import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { navLinks } from '../lib/nav'
import { useMyDoctorId } from '../features/doctor/useMyDoctorId'
import { usePendingCount } from '../features/doctor/usePendingCount'
import { ThemeToggle } from './ui/ThemeToggle'

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="bg-accent-600 text-white text-xs rounded-full min-w-5 h-5 px-1 inline-flex items-center justify-center">
      {count}
    </span>
  )
}

function Monogram() {
  return (
    <span className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </span>
  )
}

function BottomNavIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <line x1="4" y1="6" x2="4.01" y2="6" />
      <line x1="4" y1="12" x2="4.01" y2="12" />
      <line x1="4" y1="18" x2="4.01" y2="18" />
    </svg>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { appUser, role, signOut } = useAuth()
  const location = useLocation()
  const myDoctorId = useMyDoctorId()
  const isDoctor = role === 'doctor'
  const pendingCount = usePendingCount(isDoctor ? myDoctorId.data ?? undefined : undefined)
  const links = navLinks(role)

  // En uzun eşleşen link aktif sayılır: /requests/new'de yalnız 'Yeni Talep'
  // aktif olur, prefix'i olan '/requests' değil.
  const matches = (to: string) => location.pathname === to || location.pathname.startsWith(to + '/')
  const activeTo = links.filter((l) => matches(l.to)).sort((a, b) => b.to.length - a.to.length)[0]?.to
  const isActive = (to: string) => to === activeTo

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="bg-brand-fill text-brand-on px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Monogram />
          <span className="font-display text-lg font-semibold">MedTriage</span>
        </div>
        <nav className={`gap-4 text-sm items-center ${isDoctor ? 'hidden md:flex' : 'flex'}`}>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`pb-1 inline-flex items-center gap-1.5 ${isActive(l.to) ? 'border-b-2 border-white font-semibold' : 'text-white/80 hover:text-white'}`}
            >
              {l.label}
              {isDoctor && l.to === '/doctor' && <PendingBadge count={pendingCount} />}
            </Link>
          ))}
        </nav>
        <span className="text-sm flex items-center gap-2">
          <span className="hidden sm:inline">{appUser?.full_name}</span>
          <ThemeToggle />
          <button onClick={signOut} className="underline">Çıkış</button>
        </span>
      </header>
      <main className={`max-w-5xl mx-auto p-4 ${isDoctor ? 'pb-20 md:pb-4' : 'pb-4'}`}>{children}</main>
      {isDoctor && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs ${isActive(l.to) ? 'text-brand-700 font-semibold' : 'text-slate-500'}`}
            >
              <span className="relative inline-flex">
                <BottomNavIcon />
                {l.to === '/doctor' && pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-2">
                    <PendingBadge count={pendingCount} />
                  </span>
                )}
              </span>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
