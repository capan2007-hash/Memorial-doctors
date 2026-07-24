import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { ListChecks, Plus, Users, Inbox, LogOut, UserCircle, CopyCheck, UserCog, Receipt } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { navLinks } from '../lib/nav'
import { useMyDoctorId } from '../features/doctor/useMyDoctorId'
import { usePendingCount } from '../features/doctor/usePendingCount'
import { ThemeToggle } from './ui/ThemeToggle'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Icon } from './ui/Icon'

/** Rota → amaca uygun lucide ikon eşlemesi (nav etiketleri değişmeden). */
const NAV_ICONS: Record<string, LucideIcon> = {
  '/requests': ListChecks,
  '/requests/new': Plus,
  '/doctor': Inbox,
  '/profil': UserCircle,
  '/admin/requests': ListChecks,
  '/admin/duplicates': CopyCheck,
  '/admin/doctors': Users,
  '/admin/users': UserCog,
  '/admin/billing': Receipt,
  '/akis': ListChecks,
}

const navIcon = (to: string): LucideIcon => NAV_ICONS[to] ?? ListChecks

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
      {count}
    </span>
  )
}

/** Rafine marka işareti — teal zeminde küçük geometrik haç + nokta. */
function Monogram() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-fill text-white shadow-sm">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M12 4.5v15M4.5 12h15" strokeWidth={2.25} strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.25" fill="currentColor" stroke="none" opacity={0.9} />
      </svg>
    </span>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('nav')
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2.5">
            <Monogram />
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">MedTriage</span>
          </div>

          <nav className={`items-center gap-1 text-sm ${isDoctor ? 'hidden md:flex' : 'flex'}`}>
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                aria-current={isActive(l.to) ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium transition-colors ${
                  isActive(l.to)
                    ? 'bg-brand-fill/10 text-brand-text'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon of={navIcon(l.to)} size={16} />
                {t(l.labelKey)}
                {isDoctor && l.to === '/doctor' && <PendingBadge count={pendingCount} />}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{appUser?.full_name}</span>
            <LanguageSwitcher />
            <ThemeToggle />
            <button
              onClick={signOut}
              aria-label={t('nav.logout')}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon of={LogOut} size={16} />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto max-w-6xl p-4 sm:p-6 ${isDoctor ? 'pb-24 md:pb-6' : 'pb-6'}`}>{children}</main>

      {isDoctor && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/90 backdrop-blur md:hidden">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              aria-current={isActive(l.to) ? 'page' : undefined}
              className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors ${
                isActive(l.to) ? 'font-semibold text-brand-text' : 'text-muted-foreground'
              }`}
            >
              <span className="relative inline-flex">
                <Icon of={navIcon(l.to)} size={22} />
                {l.to === '/doctor' && pendingCount > 0 && (
                  <span className="absolute -right-2 -top-1.5">
                    <PendingBadge count={pendingCount} />
                  </span>
                )}
              </span>
              {t(l.labelKey)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
