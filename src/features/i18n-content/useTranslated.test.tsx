import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslated } from './useTranslated'

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
})
