import { describe, it, expect } from 'vitest'
import { applyDir } from '../index'

describe('applyDir', () => {
  it('ar → rtl, en/tr → ltr', () => {
    applyDir('ar')
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    applyDir('en')
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    applyDir('tr')
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
  })
})
