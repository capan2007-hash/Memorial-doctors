import { decideServerLanguage } from '../applyServerLanguage'

describe('decideServerLanguage (dil donma hatası regresyonu)', () => {
  it('açılış: sunucu dili farklıysa BİR KEZ uygulanır', () => {
    expect(decideServerLanguage({ alreadyApplied: false, serverLanguage: 'tr', currentLanguage: 'en' }))
      .toEqual({ shouldApply: true, markApplied: true })
  })

  it('açılış: sunucu dili zaten aynıysa uygulanmaz ama bayrak işaretlenir', () => {
    expect(decideServerLanguage({ alreadyApplied: false, serverLanguage: 'en', currentLanguage: 'en' }))
      .toEqual({ shouldApply: false, markApplied: true })
  })

  it('sunucu dili henüz yüklenmediyse bekler (bayrak işaretlenmez)', () => {
    expect(decideServerLanguage({ alreadyApplied: false, serverLanguage: null, currentLanguage: 'en' }))
      .toEqual({ shouldApply: false, markApplied: false })
  })

  // ASIL HATA: kullanıcı dili değiştirdikten sonra auth context ESKİ dilde kalır.
  // Eski davranışta effect dili geri alır → iki mount + async yarış → sonsuz ping-pong → donma.
  it('KRİTİK: kullanıcı seçtikten sonra sunucunun ESKİ dili dili GERİ ALMAZ', () => {
    expect(decideServerLanguage({ alreadyApplied: true, serverLanguage: 'en', currentLanguage: 'tr' }))
      .toEqual({ shouldApply: false, markApplied: true })
  })

  it('KRİTİK: uygulandıktan sonra tekrar tekrar tetiklense de hiçbir şey yapmaz (döngü yok)', () => {
    for (let i = 0; i < 5; i++) {
      expect(decideServerLanguage({ alreadyApplied: true, serverLanguage: 'ar', currentLanguage: 'de' }).shouldApply)
        .toBe(false)
    }
  })
})
