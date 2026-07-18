import { describe, it, expect } from 'vitest'
import { missingFields, type MissingInput } from '../missingFields'

function fullInput(): MissingInput {
  return {
    first: 'Ayşe', last: 'Yılmaz',
    ageOk: true, weightOk: true, heightOk: true,
    gender: 'female',
    categoryId: 'cat-1', needsSub: false, subcategoryId: null,
    medicalOk: true, filesCount: 1,
  }
}

describe('missingFields', () => {
  it('boş girdi için tüm alanları eksik listeler', () => {
    const empty: MissingInput = {
      first: '', last: '',
      ageOk: false, weightOk: false, heightOk: false,
      gender: '',
      categoryId: '', needsSub: false, subcategoryId: null,
      medicalOk: false, filesCount: 0,
    }
    expect(missingFields(empty)).toEqual([
      'Ad', 'Soyad', 'Yaş', 'Kilo', 'Boy', 'Cinsiyet', 'Kategori', 'Tıbbi geçmiş', 'Fotoğraf',
    ])
  })

  it('yalnız fotoğraf eksikse sadece Fotoğraf döner', () => {
    const input = { ...fullInput(), filesCount: 0 }
    expect(missingFields(input)).toEqual(['Fotoğraf'])
  })

  it('her şey tamamsa boş liste döner', () => {
    expect(missingFields(fullInput())).toEqual([])
  })

  it('needsSub true iken alt kırılım seçilmemişse listelenir', () => {
    const input = { ...fullInput(), needsSub: true, subcategoryId: null }
    expect(missingFields(input)).toEqual(['Alt kırılım'])
  })
})
