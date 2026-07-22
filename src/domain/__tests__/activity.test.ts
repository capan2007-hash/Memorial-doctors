import { describe, it, expect } from 'vitest'
import {
  activityRoleLabel,
  caseTypeLabel,
  dayGroupLabel,
  dayKey,
  doctorCountText,
  relativeTime,
  roleAccentTone,
} from '../activity'

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

describe('roleAccentTone', () => {
  it('satışçı → info (mavi), acenta → warning (amber)', () => {
    expect(roleAccentTone('sales')).toBe('info')
    expect(roleAccentTone('agent')).toBe('warning')
  })
  it('diğer roller → brand', () => {
    expect(roleAccentTone('admin')).toBe('brand')
    expect(roleAccentTone('xyz')).toBe('brand')
  })
})

describe('dayKey', () => {
  it('yerel takvim günü anahtarı', () => {
    // 2026-07-18 yerel — saat ne olursa gün aynı anahtarı verir
    expect(dayKey('2026-07-18T09:00:00')).toBe('2026-07-18')
    expect(dayKey('2026-07-18T23:30:00')).toBe('2026-07-18')
  })
  it('geçersiz tarih → boş', () => {
    expect(dayKey('bozuk')).toBe('')
  })
})

describe('dayGroupLabel', () => {
  const now = new Date(2026, 6, 22, 10, 0, 0) // 22 Tem 2026 yerel
  it('bugün / dün', () => {
    expect(dayGroupLabel(new Date(2026, 6, 22, 8, 0, 0).toISOString(), now)).toBe('Bugün')
    expect(dayGroupLabel(new Date(2026, 6, 21, 23, 0, 0).toISOString(), now)).toBe('Dün')
  })
  it('daha eski → tam tarih', () => {
    expect(dayGroupLabel(new Date(2026, 6, 18, 12, 0, 0).toISOString(), now)).toBe('18 Temmuz 2026')
  })
})

describe('relativeTime', () => {
  const now = new Date(2026, 6, 22, 12, 0, 0)
  it('eşikler', () => {
    expect(relativeTime(new Date(2026, 6, 22, 11, 59, 30).toISOString(), now)).toBe('az önce')
    expect(relativeTime(new Date(2026, 6, 22, 11, 45, 0).toISOString(), now)).toBe('15 dk önce')
    expect(relativeTime(new Date(2026, 6, 22, 9, 0, 0).toISOString(), now)).toBe('3 sa önce')
    expect(relativeTime(new Date(2026, 6, 20, 12, 0, 0).toISOString(), now)).toBe('2 gün önce')
  })
})
