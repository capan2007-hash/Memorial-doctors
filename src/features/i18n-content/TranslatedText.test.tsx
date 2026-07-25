import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import i18n from '../../i18n'
import { TranslatedText } from './TranslatedText'

// `translate` edge function çağrısını izole etmek için supabase client'ı mock'luyoruz —
// gerçek `functions.invoke` çağrılmamalı.
const invokeMock = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}))

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('TranslatedText', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  afterEach(async () => {
    // Testler arası dil kirliliğini önle (vitest.setup.ts varsayılanı 'tr').
    await i18n.changeLanguage('tr')
  })

  it('kaynak=hedef ise (full) düz metin döner, etiket/toggle yok', () => {
    renderWithClient(<TranslatedText text="Op. Dr." sourceLang="tr" />)
    expect(screen.getByText('Op. Dr.')).toBeTruthy()
    expect(screen.queryByText('autoTranslated', { exact: false })).toBeNull()
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('full modda çeviri varsa "otomatik çeviri" etiketi + orijinali göster butonu render edilir (mevcut davranış korunur)', async () => {
    await i18n.changeLanguage('en')
    invokeMock.mockResolvedValue({ data: { translated: 'Op. Dr. (EN)', cached: false }, error: null })

    renderWithClient(<TranslatedText text="Op. Dr." sourceLang="tr" />)

    await waitFor(() => expect(screen.getByText('Op. Dr. (EN)')).toBeTruthy())
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('compact modda çeviri varsa etiket/toggle GÖSTERİLMEZ, yalnız çevrilmiş metin render edilir', async () => {
    await i18n.changeLanguage('en')
    invokeMock.mockResolvedValue({ data: { translated: 'Op. Dr. (EN)', cached: false }, error: null })

    renderWithClient(<TranslatedText text="Op. Dr." sourceLang="tr" compact />)

    await waitFor(() => expect(screen.getByText('Op. Dr. (EN)')).toBeTruthy())
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('compact modda orijinal metin native title tooltip olarak verilir', async () => {
    await i18n.changeLanguage('en')
    invokeMock.mockResolvedValue({ data: { translated: 'Op. Dr. (EN)', cached: false }, error: null })

    renderWithClient(<TranslatedText text="Op. Dr." sourceLang="tr" compact />)

    await waitFor(() => {
      const el = screen.getByText('Op. Dr. (EN)')
      expect(el.getAttribute('title')).toBe('Op. Dr.')
    })
  })

  it('compact modda kaynak=hedef ise yine düz metin döner (etiket yok)', () => {
    renderWithClient(<TranslatedText text="Op. Dr." sourceLang="tr" compact />)
    expect(screen.getByText('Op. Dr.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
