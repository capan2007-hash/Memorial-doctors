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
  ])('%s: EN ve AR, TR ile aynı anahtarlara sahip', (_ns, tr, en, ar) => {
    const t = keys(tr).sort()
    expect(keys(en).sort()).toEqual(t)
    expect(keys(ar).sort()).toEqual(t)
  })
})
