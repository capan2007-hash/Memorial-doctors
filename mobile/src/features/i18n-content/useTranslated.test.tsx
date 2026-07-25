// Kaynak deseni: /src/features/i18n-content/useTranslated.test.tsx (web) — RN karşılığı.
// `@testing-library/react-hooks` mobilde kurulu değil; bu yüzden hook,
// react-test-renderer + act ile minimal bir "Probe" bileşeni üzerinden render edilir
// (aynı yaklaşım @testing-library/react-hooks'un içeride yaptığıyla örtüşür).
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslated, hashText, type TranslatedResult } from './useTranslated'

// `translate` edge function çağrısını izole etmek için supabase client'ı mock'luyoruz —
// gerçek `functions.invoke` çağrılmamalı. jest'in module-factory hoisting kısıtı
// gereği değişken adı "mock" ÖNEKİYLE başlamalı (bkz. babel-plugin-jest-hoist).
const mockInvoke = jest.fn()
jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}))

// react-query'nin `gcTime` varsayılanı (5dk) yüzünden her `QueryClient`, kullanılmayan
// query'ler için gerçek bir setTimeout kurar — test bitince renderer unmount edilse BİLE
// bu zamanlayıcı jest process'ini açık tutar ("did not exit" + process asılı kalması).
// Her testte oluşturulan client'ları burada topluyoruz; `afterEach` hepsini
// `clear()` + `unmount()` ile temizler.
const activeClients: QueryClient[] = []
const activeRenderers: ReactTestRenderer[] = []

afterEach(() => {
  activeRenderers.splice(0).forEach((r) => act(() => r.unmount()))
  activeClients.splice(0).forEach((c) => {
    c.clear()
    c.unmount()
  })
})

/** Gerçek i18next init'ini (AsyncStorage/expo-localization) tetiklemeden senkron,
 * izole bir i18n örneği — yalnız `i18n.language`'i (hedef dili) sağlamak için. */
function makeI18n(lng: string) {
  const instance = i18next.createInstance()
  instance.init({
    lng,
    fallbackLng: 'tr',
    resources: {},
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  })
  return instance
}

function renderTranslated(text: string | null | undefined, sourceLang: string, targetLang: string) {
  const result: { current: TranslatedResult } = {
    current: undefined as unknown as TranslatedResult,
  }
  function Probe() {
    result.current = useTranslated(text, sourceLang)
    return null
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  activeClients.push(client)
  const i18n = makeI18n(targetLang)
  let renderer: ReactTestRenderer
  act(() => {
    renderer = create(
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={i18n}>
          <Probe />
        </I18nextProvider>
      </QueryClientProvider>,
    )
  })
  activeRenderers.push(renderer!)
  return { result }
}

/** react-query'nin async queryFn'ini gerçek zamanlayıcılarla akıtmak için basit polling. */
async function waitFor(predicate: () => boolean, { timeout = 2000, interval = 10 } = {}) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout')
    }
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, interval))
    })
  }
}

describe('useTranslated', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('kaynak dil = hedef dil (tr) ise düz metin döner, invoke ÇAĞRILMAZ', () => {
    const { result } = renderTranslated('Merhaba', 'tr', 'tr')

    expect(result.current).toEqual({ text: 'Merhaba', isTranslated: false, isLoading: false })
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('boş/whitespace metin için de invoke ÇAĞRILMAZ', () => {
    const { result } = renderTranslated('   ', 'en', 'tr')

    expect(result.current).toEqual({ text: '   ', isTranslated: false, isLoading: false })
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('farklı kaynak dil (en → tr) için invoke çağrılır ve çevrilmiş metin döner', async () => {
    mockInvoke.mockResolvedValue({ data: { translated: 'Merhaba', cached: false }, error: null })

    const { result } = renderTranslated('Hello', 'en', 'tr')

    // Yükleniyorken orijinal metin gösterilir (placeholder değil).
    expect(result.current.isLoading).toBe(true)
    expect(result.current.text).toBe('Hello')
    expect(result.current.isTranslated).toBe(false)

    await waitFor(() => result.current.isTranslated === true)

    expect(result.current).toEqual({ text: 'Merhaba', isTranslated: true, isLoading: false })
    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('translate', {
      body: { text: 'Hello', source_lang: 'en', target_lang: 'tr' },
    })
  })

  it('invoke hata döndürürse sessiz fallback: orijinal metin, isTranslated:false', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('boom') })

    const { result } = renderTranslated('Hello', 'en', 'tr')

    await waitFor(() => result.current.isLoading === false)

    expect(result.current).toEqual({ text: 'Hello', isTranslated: false, isLoading: false })
  })

  // Çarpışma-regresyon: eski imza "uzunluk + ilk 64 karakter" idi. Aşağıdaki
  // iki metin AYNI uzunlukta ve AYNI ilk 64 karakterde ama sonrası farklı —
  // eski imzayla aynı cache girdisini paylaşıp biri diğerinin çevirisini
  // gösterirdi (triyajda yanlış-hasta çeviri riski). Tam-metin hash bunu önler.
  describe('hashText çarpışma önleme (queryKey imzası)', () => {
    const prefix = 'a'.repeat(64)
    const textA = prefix + 'PATIENT-SAFE-CASE-0001'
    const textB = prefix + 'PATIENT-RISK-CASE-9999'

    it('ön koşul: iki metin aynı uzunlukta ve ilk 64 karakteri özdeş', () => {
      expect(textA.length).toBe(textB.length)
      expect(textA.slice(0, 64)).toBe(textB.slice(0, 64))
      expect(textA).not.toBe(textB)
    })

    it('hashText aynı-uzunluk/aynı-ilk-64 metinler için FARKLI hash üretir', () => {
      expect(hashText(textA)).not.toBe(hashText(textB))
    })

    it('hashText deterministiktir (aynı girdi → aynı çıktı)', () => {
      expect(hashText(textA)).toBe(hashText(textA))
    })

    it('render edilen iki çarpışan-imzalı metin cache paylaşmaz: invoke her ikisi için ayrı çağrılır ve doğru çeviriyi alır', async () => {
      mockInvoke.mockImplementation(async (_name: string, opts: { body: { text: string } }) => {
        const translated = opts.body.text === textA ? 'GÜVENLİ-VAKA' : 'RİSKLİ-VAKA'
        return { data: { translated, cached: false }, error: null }
      })

      // Aynı QueryClient'ı iki render arasında paylaş — eski "uzunluk+ilk64"
      // imzası bu durumda ikinci render'ın cache'ini birinciyle paylaşırdı.
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      activeClients.push(client)
      const i18n = makeI18n('tr')
      const resultA: { current: TranslatedResult } = { current: undefined as unknown as TranslatedResult }
      const resultB: { current: TranslatedResult } = { current: undefined as unknown as TranslatedResult }

      function ProbeA() {
        resultA.current = useTranslated(textA, 'en')
        return null
      }
      function ProbeB() {
        resultB.current = useTranslated(textB, 'en')
        return null
      }

      let renderer: ReactTestRenderer
      act(() => {
        renderer = create(
          <QueryClientProvider client={client}>
            <I18nextProvider i18n={i18n}>
              <ProbeA />
              <ProbeB />
            </I18nextProvider>
          </QueryClientProvider>,
        )
      })
      activeRenderers.push(renderer!)

      await waitFor(() => resultA.current.isTranslated === true && resultB.current.isTranslated === true)

      expect(resultA.current.text).toBe('GÜVENLİ-VAKA')
      expect(resultB.current.text).toBe('RİSKLİ-VAKA')
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })
})
