import { describe, it, expect } from 'vitest'
import { creatableRoles, canManageTarget, roleLabel } from '../userRoles'

describe('userRoles', () => {
  it('oluşturulabilir roller', () => {
    expect(creatableRoles('coordinator')).toEqual(['sales', 'agent'])
    expect(creatableRoles('admin')).toEqual(['sales', 'agent', 'coordinator', 'admin'])
    expect(creatableRoles('sales')).toEqual([])
  })
  it('yönetim yetkisi (sıfırla/pasifleştir)', () => {
    expect(canManageTarget('coordinator', 'sales')).toBe(true)
    expect(canManageTarget('coordinator', 'doctor')).toBe(true)
    expect(canManageTarget('coordinator', 'coordinator')).toBe(false)
    expect(canManageTarget('coordinator', 'admin')).toBe(false)
    expect(canManageTarget('admin', 'coordinator')).toBe(true)
    expect(canManageTarget('admin', 'admin')).toBe(true)
    expect(canManageTarget('sales', 'agent')).toBe(false)
  })
  it('rol etiketi', () => {
    expect(roleLabel('coordinator')).toBe('Koordinatör')
    expect(roleLabel('sales')).toBe('Satışçı')
    expect(roleLabel('agent')).toBe('Aracı')
  })
})
