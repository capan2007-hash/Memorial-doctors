// Task M1-8 düzeltmesi: RTL senkron dinleyicisi (`i18n.on('languageChanged', …)`)
// artık `useAppLanguage` hook'unda değil, burada — `src/lib/rtl.ts` içinde — modül
// seviyesinde TEK bir kez kaydediliyor. Önceki hatada hook hem RootNavigator'da hem
// LanguageSwitcher'da mount olduğundan aynı olay için İKİ dinleyici tetikleniyor, bu da
// forceRTL + "yeniden başlat" Alert'inin ÇİFT görünmesine yol açıyordu.
//
// Bu test, `@/i18n`'i sahte bir event emitter ile taklit ederek şunu doğrular:
//   1) `src/lib/rtl.ts` import edildiğinde `i18n.on('languageChanged', …)` TAM OLARAK
//      bir kez çağrılır (kaç kez require edilirse edilsin — modül önbelleklenir).
//   2) Aynı `languageChanged` olayı için TEK bir Alert gösterilir.
//   3) Aynı oturumda tekrarlanan mismatch'ler bile ek Alert göstermez (oturum bayrağı).
import { Alert, I18nManager } from 'react-native'

type Listener = (lng: string) => void

// jest.mock fabrikası dış kapsamdaki değişkenlere erişemez (babel-plugin-jest-hoist),
// bu yüzden sahte i18n nesnesi doğrudan fabrika içinde kuruluyor.
jest.mock('@/i18n', () => {
  const listeners: Listener[] = []
  const fake = {
    language: 'tr',
    t: (key: string) => key,
    on: jest.fn((event: string, cb: Listener) => {
      if (event === 'languageChanged') listeners.push(cb)
    }),
    off: jest.fn((event: string, cb: Listener) => {
      if (event !== 'languageChanged') return
      const idx = listeners.indexOf(cb)
      if (idx >= 0) listeners.splice(idx, 1)
    }),
    emit: (lng: string) => {
      for (const cb of [...listeners]) cb(lng)
    },
  }
  return {
    __esModule: true,
    RTL_LANGS: new Set(['ar']),
    default: fake,
  }
})

type FakeI18n = {
  language: string
  t: (key: string) => string
  on: jest.Mock
  off: jest.Mock
  emit: (lng: string) => void
}

describe('RTL senkron dinleyicisi (tekilleştirme)', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('rtl.ts modülü kaç kez import edilirse edilsin i18n.on TEK kez çağrılır', () => {
    const fakeI18n = jest.requireMock('@/i18n').default as FakeI18n

    // Gerçek uygulamada birden çok dosya `@/lib/rtl`'i import eder
    // (RootNavigator → useAppLanguage, LanguageSwitcher, çeşitli ekranlar → rtlIconStyle).
    // ES modülleri singleton olduğundan hepsi AYNI modül örneğini paylaşır.
    require('@/lib/rtl')
    require('@/lib/rtl')
    require('@/lib/rtl')

    const languageChangedCalls = fakeI18n.on.mock.calls.filter(([event]) => event === 'languageChanged')
    expect(languageChangedCalls).toHaveLength(1)
  })

  it('tek languageChanged olayı → tek forceRTL + tek Alert (çift dinleyici hatası oluşmaz)', () => {
    const fakeI18n = jest.requireMock('@/i18n').default as FakeI18n
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const forceRtlSpy = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {})

    require('@/lib/rtl')

    // Önceki (hatalı) mimaride bu senaryo tam olarak çift-mount durumuna denk düşerdi:
    // RootNavigator'ın hook'u VE LanguageSwitcher'ın hook'u aynı 'languageChanged'
    // olayında ikişer kez syncRtlDirection çağırırdı. Artık dinleyici tek olduğundan
    // fake emitter'ın TEK emit'i, kayıtlı TEK dinleyiciyi bir kez tetikler.
    fakeI18n.emit('ar')

    expect(forceRtlSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledTimes(1)
  })

  it('bir oturumda ikinci bir mismatch bile ek Alert göstermez (oturum bayrağı)', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    const { syncRtlDirection } = require('@/lib/rtl')

    syncRtlDirection('ar')
    syncRtlDirection('ar')
    syncRtlDirection('ar')

    expect(alertSpy).toHaveBeenCalledTimes(1)
  })
})
