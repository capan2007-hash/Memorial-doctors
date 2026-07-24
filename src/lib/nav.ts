import type { Role } from '../types/domain'

export interface NavLink { to: string; labelKey: string }

export function navLinks(role: Role | null): NavLink[] {
  switch (role) {
    case 'agent':
      return [{ to: '/requests', labelKey: 'nav.requests' }, { to: '/requests/new', labelKey: 'nav.newRequest' }]
    case 'sales':
      return [
        { to: '/requests', labelKey: 'nav.requests' },
        { to: '/requests/new', labelKey: 'nav.newRequest' },
        { to: '/akis', labelKey: 'nav.activity' },
      ]
    case 'doctor':
      return [
        { to: '/doctor', labelKey: 'nav.pending' },
        { to: '/profil', labelKey: 'nav.profile' },
      ]
    case 'coordinator':
    case 'admin':
    case 'super_admin': {
      const links: NavLink[] = [{ to: '/admin/requests', labelKey: 'nav.allRequests' }, { to: '/admin/duplicates', labelKey: 'nav.duplicates' }, { to: '/admin/doctors', labelKey: 'nav.doctors' }, { to: '/admin/users', labelKey: 'nav.users' }]
      // Akış (aktivite timeline): admin + super_admin görür; koordinatör görmez.
      if (role === 'admin' || role === 'super_admin') links.push({ to: '/akis', labelKey: 'nav.activity' })
      if (role === 'super_admin') links.push({ to: '/admin/billing', labelKey: 'nav.billing' })
      return links
    }
    default:
      return []
  }
}
