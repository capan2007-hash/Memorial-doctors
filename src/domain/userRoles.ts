import type { Role } from '../types/domain'

const CREATABLE: Record<Role, Role[]> = {
  admin: ['sales', 'agent', 'coordinator', 'admin'],
  coordinator: ['sales', 'agent'],
  sales: [], agent: [], doctor: [],
}
export function creatableRoles(caller: Role): Role[] { return CREATABLE[caller] ?? [] }

// Sıfırla/pasifleştir yetkisi: admin herkesi; koordinatör yalnız operasyonel (sales/agent/doctor).
export function canManageTarget(caller: Role, target: Role): boolean {
  if (caller === 'admin') return true
  if (caller === 'coordinator') return ['sales', 'agent', 'doctor'].includes(target)
  return false
}

const LABELS: Record<Role, string> = {
  admin: 'Yönetici', coordinator: 'Koordinatör', doctor: 'Doktor', sales: 'Satışçı', agent: 'Aracı',
}
export function roleLabel(r: Role): string { return LABELS[r] }
