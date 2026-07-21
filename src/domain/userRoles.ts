import type { Role } from '../types/domain'

const CREATABLE: Record<Role, Role[]> = {
  super_admin: ['sales', 'agent', 'coordinator', 'admin', 'super_admin'],
  admin: ['sales', 'agent', 'coordinator', 'admin'], // admin, super_admin OLUŞTURAMAZ (yetki-yükseltme engeli)
  coordinator: ['sales', 'agent'],
  sales: [], agent: [], doctor: [],
}
export function creatableRoles(caller: Role): Role[] { return CREATABLE[caller] ?? [] }

// Sıfırla/pasifleştir yetkisi: super_admin herkesi; admin super_admin HARİÇ herkesi;
// koordinatör yalnız operasyonel (sales/agent/doctor).
export function canManageTarget(caller: Role, target: Role): boolean {
  if (caller === 'super_admin') return true
  if (caller === 'admin') return target !== 'super_admin'
  if (caller === 'coordinator') return ['sales', 'agent', 'doctor'].includes(target)
  return false
}

const LABELS: Record<Role, string> = {
  super_admin: 'Süper Admin', admin: 'Yönetici', coordinator: 'Koordinatör', doctor: 'Doktor', sales: 'Satışçı', agent: 'Aracı',
}
export function roleLabel(r: Role): string { return LABELS[r] }
