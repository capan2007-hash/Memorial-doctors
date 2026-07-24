import { describe, it, expect } from 'vitest'
import tr from '../locales/tr/common.json'
import en from '../locales/en/common.json'
import ar from '../locales/ar/common.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`])
}
describe('i18n key parity', () => {
  it('EN ve AR, TR ile aynı anahtarlara sahip', () => {
    const t = keys(tr).sort()
    expect(keys(en).sort()).toEqual(t)
    expect(keys(ar).sort()).toEqual(t)
  })
})
