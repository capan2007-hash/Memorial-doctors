import { canManageTarget, creatableRoles, roleLabel } from '../userRoles'

describe('creatableRoles', () => {
  it('koordinatör yalnız sales/agent', () => {
    expect(creatableRoles('coordinator')).toEqual(['sales', 'agent'])
  })
  it('admin super_admin oluşturamaz', () => {
    expect(creatableRoles('admin')).not.toContain('super_admin')
    expect(creatableRoles('admin')).toContain('coordinator')
  })
  it('super_admin hepsini', () => {
    expect(creatableRoles('super_admin')).toContain('super_admin')
  })
  it('operasyonel roller kimse oluşturamaz', () => {
    expect(creatableRoles('sales')).toEqual([])
    expect(creatableRoles('doctor')).toEqual([])
  })
})

describe('canManageTarget', () => {
  it('koordinatör sales/agent/doctor yönetir, admin/super_admin yönetemez', () => {
    expect(canManageTarget('coordinator', 'sales')).toBe(true)
    expect(canManageTarget('coordinator', 'doctor')).toBe(true)
    expect(canManageTarget('coordinator', 'admin')).toBe(false)
    expect(canManageTarget('coordinator', 'super_admin')).toBe(false)
  })
  it('admin super_admin hariç herkesi', () => {
    expect(canManageTarget('admin', 'coordinator')).toBe(true)
    expect(canManageTarget('admin', 'super_admin')).toBe(false)
  })
  it('super_admin herkesi', () => {
    expect(canManageTarget('super_admin', 'super_admin')).toBe(true)
  })
})

describe('roleLabel', () => {
  it('etiketler', () => {
    expect(roleLabel('coordinator')).toBe('Koordinatör')
    expect(roleLabel('agent')).toBe('Aracı')
    expect(roleLabel('super_admin')).toBe('Süper Admin')
  })
})
