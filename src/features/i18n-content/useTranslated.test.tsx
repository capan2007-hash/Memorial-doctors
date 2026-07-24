import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslated, hashText } from './useTranslated'

// `translate` edge function çağrısını izole etmek için supabase client'ı mock'luyoruz —
// gerçek `functions.invoke` çağrılmamalı (Anthropic kredisi olmadan gerçek çeviri
// üretilemiyor; bu test yalnız hook'un client-taraflı davranışını doğruluyor).
const invokeMock = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}))

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useTranslated', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('kaynak dil = hedef dil (tr) ise düz metin döner, invoke ÇAĞRILMAZ', () => {
    const { result } = renderHook(() => useTranslated('Merhaba', 'tr'), { wrapper: makeWrapper() })

    expect(result.current).toEqual({ text: 'Merhaba', isTranslated: false, isLoading: false })
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('boş/whitespace metin için de invoke ÇAĞRILMAZ', () => {
    const { result } = renderHook(() => useTranslated('   ', 'en'), { wrapper: makeWrapper() })

    // Kısa devre dalında orijinal metin aynen döner (brief: `text ?? ''`).
    expect(result.current).toEqual({ text: '   ', isTranslated: false, isLoading: false })
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('farklı kaynak dil (en → tr) için invoke çağrılır ve çevrilmiş metin döner', async () => {
    invokeMock.mockResolvedValue({ data: { translated: 'Merhaba', cached: false }, error: null })

    const { result } = renderHook(() => useTranslated('Hello', 'en'), { wrapper: makeWrapper() })

    // Yükleniyorken orijinal metin gösterilir (placeholder değil).
    expect(result.current.isLoading).toBe(true)
    expect(result.current.text).toBe('Hello')
    expect(result.current.isTranslated).toBe(false)

    await waitFor(() => expect(result.current.isTranslated).toBe(true))

    expect(result.current).toEqual({ text: 'Merhaba', isTranslated: true, isLoading: false })
    expect(invokeMock).toHaveBeenCalledTimes(1)
    expect(invokeMock).toHaveBeenCalledWith('translate', {
      body: { text: 'Hello', source_lang: 'en', target_lang: 'tr' },
    })
  })

  it('invoke hata döndürürse sessiz fallback: orijinal metin, isTranslated:false', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') })

    const { result } = renderHook(() => useTranslated('Hello', 'en'), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current).toEqual({ text: 'Hello', isTranslated: false, isLoading: false })
  })

  // Çarpışma-regresyon: eski imza "uzunluk + ilk 64 karakter" idi. Aşağıdaki
  // iki metin AYNI uzunlukta ve AYNI ilk 64 karakterde ama sonrası farklı —
  // eski imzayla aynı cache girdisini paylaşıp biri diğerinin çevirisini
  // gösterirdi (triyajda yanlış-hasta çeviri riski). Tam-metin hash bunu önler.
  describe('hashText çarpışma önleme (queryKey imzası)', () => {
    const prefix = 'a'.repeat(64)
    // "PATIENT-" ortak önek + farklı gövde, ama toplam uzunluklar eşit (22 char).
    const textA = prefix + 'PATIENT-SAFE-CASE-0001'
    const textB = prefix + 'PATIENT-RISK-CASE-9999'

    it('ön koşul: iki metin aynı uzunlukta ve ilk 64 karakteri özdeş', () => {
      expect(textA.length).toBe(textB.length)
      expect(textA.slice(0, 64)).toBe(textB.slice(0, 64))
      expect(textA).not.toBe(textB)
    })

    it('hashText aynı-uzunluk/aynı-ilk-64 metinler için FARKLI hash üretir', () => {
      const hashA = hashText(textA)
      const hashB = hashText(textB)
      expect(hashA).not.toBe(hashB)
    })

    it('hashText deterministiktir (aynı girdi → aynı çıktı)', () => {
      expect(hashText(textA)).toBe(hashText(textA))
    })

    it('render edilen iki çarpışan-imzalı metin cache paylaşmaz: invoke her ikisi için ayrı çağrılır ve doğru çeviriyi alır', async () => {
      invokeMock.mockImplementation(async (_name: string, opts: { body: { text: string } }) => {
        const translated = opts.body.text === textA ? 'GÜVENLİ-VAKA' : 'RİSKLİ-VAKA'
        return { data: { translated, cached: false }, error: null }
      })

      // Aynı QueryClient'ı iki render arasında paylaş — eski "uzunluk+ilk64"
      // imzası bu durumda ikinci render'ın cache'ini birinciyle paylaşırdı.
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const Wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )

      const renderA = renderHook(() => useTranslated(textA, 'en'), { wrapper: Wrapper })
      const renderB = renderHook(() => useTranslated(textB, 'en'), { wrapper: Wrapper })

      await waitFor(() => expect(renderA.result.current.isTranslated).toBe(true))
      await waitFor(() => expect(renderB.result.current.isTranslated).toBe(true))

      expect(renderA.result.current.text).toBe('GÜVENLİ-VAKA')
      expect(renderB.result.current.text).toBe('RİSKLİ-VAKA')
      expect(invokeMock).toHaveBeenCalledTimes(2)
    })
  })
})
