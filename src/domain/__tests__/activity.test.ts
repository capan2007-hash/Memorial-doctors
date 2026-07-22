import { describe, it, expect } from 'vitest'
import { activityRoleLabel, caseTypeLabel, doctorCountText } from '../activity'

describe('activityRoleLabel', () => {
  it('agent → Acenta, sales → Satışçı', () => {
    expect(activityRoleLabel('agent')).toBe('Acenta')
    expect(activityRoleLabel('sales')).toBe('Satışçı')
  })
  it('diğer roller', () => {
    expect(activityRoleLabel('admin')).toBe('Yönetici')
    expect(activityRoleLabel('super_admin')).toBe('Süper Admin')
    expect(activityRoleLabel('coordinator')).toBe('Koordinatör')
    expect(activityRoleLabel('doctor')).toBe('Doktor')
  })
  it('bilinmeyen rol → Kullanıcı', () => {
    expect(activityRoleLabel('xyz')).toBe('Kullanıcı')
  })
})

describe('caseTypeLabel', () => {
  it('alt kırılım önceliklidir', () => {
    expect(caseTypeLabel('Plastik Cerrahi', 'Burun estetiği')).toBe('Burun estetiği')
  })
  it('alt kırılım yoksa kategori', () => {
    expect(caseTypeLabel('Saç Ekimi', null)).toBe('Saç Ekimi')
  })
  it('ikisi de boşsa estetik', () => {
    expect(caseTypeLabel(null, null)).toBe('estetik')
    expect(caseTypeLabel('   ', null)).toBe('estetik')
  })
})

describe('doctorCountText', () => {
  it('pozitif sayı', () => {
    expect(doctorCountText(6)).toBe('6 doktora yönlendirildi')
    expect(doctorCountText(1)).toBe('1 doktora yönlendirildi')
  })
  it('sıfır', () => {
    expect(doctorCountText(0)).toBe('doktora yönlendirilmedi')
  })
})
