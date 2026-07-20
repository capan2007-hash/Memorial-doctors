import { describe, it, expect } from 'vitest'
import { missingFields, type MissingInput } from '../missingFields'

function fullInput(): MissingInput {
  return {
    first: 'Ayşe', last: 'Yılmaz', phoneOk: true,
    ageOk: true, weightOk: true, heightOk: true,
    gender: 'female',
    categoryId: 'cat-1', needsSub: false, subcategoryId: null,
    medicalOk: true, lifestyleOk: true, filesCount: 1,
  }
}

describe('missingFields', () => {
  it('boş girdi için tüm alanları eksik listeler', () => {
    const empty: MissingInput = {
      first: '', last: '', phoneOk: false,
      ageOk: false, weightOk: false, heightOk: false,
      gender: '',
      categoryId: '', needsSub: false, subcategoryId: null,
      medicalOk: false, lifestyleOk: false, filesCount: 0,
    }
    expect(missingFields(empty)).toEqual([
      'Ad', 'Soyad', 'Telefon', 'Yaş', 'Kilo', 'Boy', 'Cinsiyet', 'Kategori', 'Tıbbi geçmiş', 'Sigara/alkol bilgisi', 'Fotoğraf',
    ])
  })

  it('yalnız sigara/alkol eksikse sadece o döner', () => {
    const input = { ...fullInput(), lifestyleOk: false }
    expect(missingFields(input)).toEqual(['Sigara/alkol bilgisi'])
  })

  it('yalnız telefon eksikse sadece Telefon döner', () => {
    const input = { ...fullInput(), phoneOk: false }
    expect(missingFields(input)).toEqual(['Telefon'])
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
