import { describe, it, expect, beforeEach } from 'vitest'
import { saveDraft, loadDraft, clearDraft, isDraftEmpty, type RequestDraft } from '../requestDraft'

function emptyDraft(): RequestDraft {
  return {
    first: '', last: '', phone: '', age: '', weightKg: '', heightCm: '',
    gender: '',
    pastSurgeries: { none: false, text: '' },
    knownConditions: { none: false, text: '' },
    medications: { none: false, text: '' },
    categoryId: '', subcategoryId: null, operationTypeId: null,
    notes: '', files: [], xrayFiles: [],
  }
}

beforeEach(() => {
  clearDraft()
})

describe('saveDraft / loadDraft', () => {
  it('kaydedilen taslak aynı alanlarla geri yüklenir (dosyalar dahil)', () => {
    const file = new File(['x'], 'a.jpg')
    const draft: RequestDraft = {
      ...emptyDraft(),
      first: 'Ayşe', last: 'Yılmaz', phone: '5321112233', age: '29', weightKg: '62', heightCm: '165',
      gender: 'female',
      pastSurgeries: { none: true, text: '' },
      knownConditions: { none: false, text: 'astım' },
      medications: { none: false, text: 'ventolin' },
      categoryId: 'cat-1', subcategoryId: 'sub-1', operationTypeId: 'op-1',
      notes: 'not', files: [file], xrayFiles: [],
    }
    saveDraft(draft)
    const loaded = loadDraft()
    expect(loaded).toEqual(draft)
    expect(loaded?.files[0]).toBe(file)
  })

  it('taslak yoksa loadDraft null döner', () => {
    expect(loadDraft()).toBeNull()
  })
})

describe('clearDraft', () => {
  it('taslağı temizler, loadDraft null döner', () => {
    saveDraft({ ...emptyDraft(), first: 'Ayşe' })
    clearDraft()
    expect(loadDraft()).toBeNull()
  })
})

describe('isDraftEmpty', () => {
  it('tüm alanlar varsayılan değerdeyse true', () => {
    expect(isDraftEmpty(emptyDraft())).toBe(true)
  })

  it('first doluysa false', () => {
    expect(isDraftEmpty({ ...emptyDraft(), first: 'Ayşe' })).toBe(false)
  })

  it('files doluysa false', () => {
    const file = new File(['x'], 'a.jpg')
    expect(isDraftEmpty({ ...emptyDraft(), files: [file] })).toBe(false)
  })

  it('pastSurgeries.none true ise false', () => {
    expect(isDraftEmpty({ ...emptyDraft(), pastSurgeries: { none: true, text: '' } })).toBe(false)
  })

  it('phone doluysa false', () => {
    expect(isDraftEmpty({ ...emptyDraft(), phone: '532' })).toBe(false)
  })
})
