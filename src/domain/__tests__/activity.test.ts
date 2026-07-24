import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import {
  activityRoleLabel,
  caseTypeLabel,
  dayGroupLabel,
  dayKey,
  doctorCountText,
  relativeTime,
  roleAccentTone,
} from '../activity'
import trActivity from '../../i18n/locales/tr/activity.json'

/** Test için gerçek TR sözlüğünden basit bir t(): iç içe anahtar + {{count}}/{{...}} enterpolasyonu. */
function makeT(dict: Record<string, unknown>): TFunction {
  const flat = new Map<string, string>()
  const walk = (o: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(o)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object') walk(v as Record<string, unknown>, key)
      else flat.set(key, String(v))
    }
  }
  walk(dict, '')
  return ((key: string, opts?: Record<string, unknown>) => {
    const count = opts?.count as number | undefined
    let resolvedKey = key
    if (count !== undefined) {
      const pluralKey = count === 1 ? `${key}_one` : `${key}_other`
      if (flat.has(pluralKey)) resolvedKey = pluralKey
    }
    let value = flat.get(resolvedKey) ?? key
    if (opts) {
      for (const [k, v] of Object.entries(opts)) {
        value = value.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
      }
    }
    return value
  }) as TFunction
}

const t = makeT(trActivity)

describe('activityRoleLabel', () => {
  it('agent → Acenta, sales → Satışçı', () => {
    expect(activityRoleLabel('agent', t)).toBe('Acenta')
    expect(activityRoleLabel('sales', t)).toBe('Satışçı')
  })
  it('diğer roller', () => {
    expect(activityRoleLabel('admin', t)).toBe('Yönetici')
    expect(activityRoleLabel('super_admin', t)).toBe('Süper Admin')
    expect(activityRoleLabel('coordinator', t)).toBe('Koordinatör')
    expect(activityRoleLabel('doctor', t)).toBe('Doktor')
  })
  it('bilinmeyen rol → Kullanıcı', () => {
    expect(activityRoleLabel('xyz', t)).toBe('Kullanıcı')
  })
})

describe('caseTypeLabel', () => {
  it('alt kırılım önceliklidir', () => {
    expect(caseTypeLabel('Plastik Cerrahi', 'Burun estetiği', t)).toBe('Burun estetiği')
  })
  it('alt kırılım yoksa kategori', () => {
    expect(caseTypeLabel('Saç Ekimi', null, t)).toBe('Saç Ekimi')
  })
  it('ikisi de boşsa estetik', () => {
    expect(caseTypeLabel(null, null, t)).toBe('estetik')
    expect(caseTypeLabel('   ', null, t)).toBe('estetik')
  })
})

describe('doctorCountText', () => {
  it('pozitif sayı', () => {
    expect(doctorCountText(6, t)).toBe('6 doktora yönlendirildi')
    expect(doctorCountText(1, t)).toBe('1 doktora yönlendirildi')
  })
  it('sıfır', () => {
    expect(doctorCountText(0, t)).toBe('doktora yönlendirilmedi')
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
    expect(dayGroupLabel(new Date(2026, 6, 22, 8, 0, 0).toISOString(), t, 'tr', now)).toBe('Bugün')
    expect(dayGroupLabel(new Date(2026, 6, 21, 23, 0, 0).toISOString(), t, 'tr', now)).toBe('Dün')
  })
  it('daha eski → tam tarih', () => {
    expect(dayGroupLabel(new Date(2026, 6, 18, 12, 0, 0).toISOString(), t, 'tr', now)).toBe('18 Temmuz 2026')
  })
})

describe('relativeTime', () => {
  const now = new Date(2026, 6, 22, 12, 0, 0)
  it('eşikler', () => {
    expect(relativeTime(new Date(2026, 6, 22, 11, 59, 30).toISOString(), t, now)).toBe('az önce')
    expect(relativeTime(new Date(2026, 6, 22, 11, 45, 0).toISOString(), t, now)).toBe('15 dk önce')
    expect(relativeTime(new Date(2026, 6, 22, 9, 0, 0).toISOString(), t, now)).toBe('3 sa önce')
    expect(relativeTime(new Date(2026, 6, 20, 12, 0, 0).toISOString(), t, now)).toBe('2 gün önce')
  })
})
