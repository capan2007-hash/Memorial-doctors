import type { Role } from '../types/domain'

export interface NavLink { to: string; labelKey: string }

export function navLinks(role: Role | null): NavLink[] {
  switch (role) {
    case 'agent':
      return [{ to: '/requests', labelKey: 'requests' }, { to: '/requests/new', labelKey: 'newRequest' }]
    case 'sales':
      return [
        { to: '/requests', labelKey: 'requests' },
        { to: '/requests/new', labelKey: 'newRequest' },
        { to: '/akis', labelKey: 'activity' },
      ]
    case 'doctor':
      return [
        { to: '/doctor', labelKey: 'pending' },
        { to: '/profil', labelKey: 'profile' },
      ]
    case 'coordinator':
    case 'admin':
    case 'super_admin': {
      const links: NavLink[] = [{ to: '/admin/requests', labelKey: 'allRequests' }, { to: '/admin/duplicates', labelKey: 'duplicates' }, { to: '/admin/doctors', labelKey: 'doctors' }, { to: '/admin/users', labelKey: 'users' }]
      // Akış (aktivite timeline): admin + super_admin görür; koordinatör görmez.
      if (role === 'admin' || role === 'super_admin') links.push({ to: '/akis', labelKey: 'activity' })
      if (role === 'super_admin') links.push({ to: '/admin/billing', labelKey: 'billing' })
      return links
    }
    default:
      return []
  }
}
