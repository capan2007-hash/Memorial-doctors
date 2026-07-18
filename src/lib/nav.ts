import type { Role } from '../types/domain'

export interface NavLink { to: string; label: string }

export function navLinks(role: Role | null): NavLink[] {
  switch (role) {
    case 'sales':
    case 'agent':
      return [{ to: '/requests', label: 'Talepler' }, { to: '/requests/new', label: 'Yeni Talep' }]
    case 'doctor':
      return [{ to: '/doctor', label: 'Bekleyen Talepler' }]
    case 'coordinator':
    case 'admin':
      return [{ to: '/admin/requests', label: 'Tüm Talepler' }, { to: '/admin/doctors', label: 'Doktor Yönetimi' }]
    default:
      return []
  }
}
