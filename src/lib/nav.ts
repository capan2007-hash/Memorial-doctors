import type { Role } from '../types/domain'

export interface NavLink { to: string; label: string }

export function navLinks(role: Role | null): NavLink[] {
  switch (role) {
    case 'agent':
      return [{ to: '/requests', label: 'Talepler' }, { to: '/requests/new', label: 'Yeni Talep' }]
    case 'sales':
      return [
        { to: '/requests', label: 'Talepler' },
        { to: '/requests/new', label: 'Yeni Talep' },
        { to: '/akis', label: 'Akış' },
      ]
    case 'doctor':
      return [
        { to: '/doctor', label: 'Bekleyen Talepler' },
        { to: '/profil', label: 'Profilim' },
      ]
    case 'coordinator':
    case 'admin':
    case 'super_admin': {
      const links: NavLink[] = [{ to: '/admin/requests', label: 'Tüm Talepler' }, { to: '/admin/duplicates', label: 'Mükerrer Talep' }, { to: '/admin/doctors', label: 'Doktor Yönetimi' }, { to: '/admin/users', label: 'Kullanıcı Yönetimi' }]
      // Akış (aktivite timeline): admin + super_admin görür; koordinatör görmez.
      if (role === 'admin' || role === 'super_admin') links.push({ to: '/akis', label: 'Akış' })
      if (role === 'super_admin') links.push({ to: '/admin/billing', label: 'Billing' })
      return links
    }
    default:
      return []
  }
}
