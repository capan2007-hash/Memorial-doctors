import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ListChecks, Plus, Users, Inbox, LogOut, UserCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { navLinks } from '../lib/nav'
import { useMyDoctorId } from '../features/doctor/useMyDoctorId'
import { usePendingCount } from '../features/doctor/usePendingCount'
import { ThemeToggle } from './ui/ThemeToggle'
import { Icon } from './ui/Icon'

/** Rota → amaca uygun lucide ikon eşlemesi (nav etiketleri değişmeden). */
const NAV_ICONS: Record<string, LucideIcon> = {
  '/requests': ListChecks,
  '/requests/new': Plus,
  '/doctor': Inbox,
  '/profil': UserCircle,
  '/admin/requests': ListChecks,
  '/admin/doctors': Users,
}

const navIcon = (to: string): LucideIcon => NAV_ICONS[to] ?? ListChecks

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-bg px-1 text-xs font-semibold text-danger-text">
      {count}
    </span>
  )
}

/** Rafine marka işareti — küçük geometrik teal haç + nokta. */
function Monogram() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-control bg-brand-on/10">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M12 4.5v15M4.5 12h15" strokeWidth={2.25} strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.25" fill="currentColor" stroke="none" opacity={0.9} />
      </svg>
    </span>
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
      <header className="flex items-center justify-between gap-4 bg-brand-fill px-4 py-3 text-brand-on shadow-card">
        <div className="flex items-center gap-2.5">
          <Monogram />
          <span className="font-display text-lg font-semibold tracking-tight">MedTriage</span>
        </div>
        <nav className={`items-center gap-1 text-sm ${isDoctor ? 'hidden md:flex' : 'flex'}`}>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`inline-flex items-center gap-1.5 border-b-2 px-1.5 pb-1 pt-0.5 transition-colors duration-[var(--dur-fast)] ease-premium ${
                isActive(l.to)
                  ? 'border-brand-on font-semibold text-brand-on'
                  : 'border-transparent text-brand-on/80 hover:text-brand-on'
              }`}
            >
              <Icon of={navIcon(l.to)} size={16} />
              {l.label}
              {isDoctor && l.to === '/doctor' && <PendingBadge count={pendingCount} />}
            </Link>
          ))}
        </nav>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="hidden sm:inline text-brand-on/90">{appUser?.full_name}</span>
          <ThemeToggle />
          <button
            onClick={signOut}
            aria-label="Çıkış"
            className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 font-medium text-brand-on/90 transition-colors duration-[var(--dur-fast)] ease-premium hover:bg-brand-on/10 hover:text-brand-on"
          >
            <Icon of={LogOut} size={16} />
            <span className="hidden sm:inline">Çıkış</span>
          </button>
        </span>
      </header>
      <main className={`max-w-5xl mx-auto p-4 ${isDoctor ? 'pb-20 md:pb-4' : 'pb-4'}`}>{children}</main>
      {isDoctor && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-line bg-surface-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors duration-[var(--dur-fast)] ease-premium ${
                isActive(l.to) ? 'font-semibold text-brand-text' : 'text-ink-muted'
              }`}
            >
              <span className="relative inline-flex">
                <Icon of={navIcon(l.to)} size={22} />
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
