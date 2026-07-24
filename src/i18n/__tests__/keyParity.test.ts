import { describe, it, expect } from 'vitest'
import trCommon from '../locales/tr/common.json'
import enCommon from '../locales/en/common.json'
import arCommon from '../locales/ar/common.json'
import trNav from '../locales/tr/nav.json'
import enNav from '../locales/en/nav.json'
import arNav from '../locales/ar/nav.json'
import trAuth from '../locales/tr/auth.json'
import enAuth from '../locales/en/auth.json'
import arAuth from '../locales/ar/auth.json'
import trRequests from '../locales/tr/requests.json'
import enRequests from '../locales/en/requests.json'
import arRequests from '../locales/ar/requests.json'
import trDoctors from '../locales/tr/doctors.json'
import enDoctors from '../locales/en/doctors.json'
import arDoctors from '../locales/ar/doctors.json'
import trAdmin from '../locales/tr/admin.json'
import enAdmin from '../locales/en/admin.json'
import arAdmin from '../locales/ar/admin.json'
import trAi from '../locales/tr/ai.json'
import enAi from '../locales/en/ai.json'
import arAi from '../locales/ar/ai.json'
import trActivity from '../locales/tr/activity.json'
import enActivity from '../locales/en/activity.json'
import arActivity from '../locales/ar/activity.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`])
}

describe('i18n key parity', () => {
  it.each([
    ['common', trCommon, enCommon, arCommon],
    ['nav', trNav, enNav, arNav],
    ['auth', trAuth, enAuth, arAuth],
    ['requests', trRequests, enRequests, arRequests],
    ['doctors', trDoctors, enDoctors, arDoctors],
    ['admin', trAdmin, enAdmin, arAdmin],
    ['ai', trAi, enAi, arAi],
    ['activity', trActivity, enActivity, arActivity],
  ])('%s: EN ve AR, TR ile aynı anahtarlara sahip', (_ns, tr, en, ar) => {
    const t = keys(tr).sort()
    expect(keys(en).sort()).toEqual(t)
    expect(keys(ar).sort()).toEqual(t)
  })
})
