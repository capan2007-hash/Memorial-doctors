import { matchesSearch, filterBySearch } from '../searchRequests'

const rows = [
  { patientName: 'Ayşe Yılmaz', patientPhone: '0555 123 45 67' },
  { patientName: 'Mehmet Demir', patientPhone: '+90 532 000 11 22' },
  { patientName: 'Fatma Kaya', patientPhone: null },
]

describe('matchesSearch (mobil)', () => {
  it('boş sorgu her kaydı eşler', () => {
    expect(matchesSearch(rows[0], '')).toBe(true)
  })
  it('ada göre (kısmi, büyük/küçük duyarsız)', () => {
    expect(matchesSearch(rows[0], 'yılmaz')).toBe(true)
    expect(matchesSearch(rows[0], 'mehmet')).toBe(false)
  })
  it('telefona göre (biçim farkı önemsiz)', () => {
    expect(matchesSearch(rows[0], '5551234')).toBe(true)
    expect(matchesSearch(rows[1], '53200011')).toBe(true)
  })
  it('telefonu null olan kayıt telefon aramasında eşleşmez', () => {
    expect(matchesSearch(rows[2], '555')).toBe(false)
  })
})

describe('filterBySearch (mobil)', () => {
  it('ada göre süzer', () => {
    expect(filterBySearch(rows, 'demir').map((r) => r.patientName)).toEqual(['Mehmet Demir'])
  })
  it('telefona göre süzer', () => {
    expect(filterBySearch(rows, '532').map((r) => r.patientName)).toEqual(['Mehmet Demir'])
  })
  it('boş sorgu tüm listeyi döndürür', () => {
    expect(filterBySearch(rows, ' ')).toHaveLength(3)
  })
})
