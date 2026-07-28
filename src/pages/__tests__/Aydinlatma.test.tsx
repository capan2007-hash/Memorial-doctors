import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '../../i18n'
import { Aydinlatma } from '../Aydinlatma'
import { getLegalDocument } from '../legal'

// LanguageSwitcher → useAppLanguage → useAuth: bu sayfa AuthProvider olmadan
// da render edilebilmeli (public route). useAuth'u burada sahteleyip
// appUser'ı null bırakıyoruz — böylece useSetLanguage.mutate hiç tetiklenmez
// ve gerçek bir oturum/sunucu bağımlılığı gerekmez.
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ appUser: null, refreshAppUser: async () => {} }),
}))

function renderPage(initialPath: string, props?: { identityComplete?: boolean }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Aydinlatma {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Aydinlatma sayfası', () => {
  beforeEach(async () => {
    await act(async () => { await i18n.changeLanguage('tr') })
  })
  afterEach(async () => {
    await act(async () => { await i18n.changeLanguage('tr') })
  })

  it('?lang=ar ile açılış Arapça başlığı render eder ve <html dir> rtl olur', async () => {
    renderPage('/aydinlatma?lang=ar')

    await waitFor(() => {
      expect(screen.getByText(getLegalDocument('ar').title)).toBeTruthy()
    })
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
  })

  // FIX 1 regresyon testi: ?lang= yalnız İLK YÜKLEMEDE tohumdur. Dil seçici
  // (veya doğrudan i18n.changeLanguage) ile değiştirilince YENİ dilde kalması
  // gerekir — eski koddaki [urlLang, i18n] bağımlılıklı efekt + `urlLang ??
  // i18n.language` render mantığı yüzünden bir kare sonra Arapçaya geri dönerdi.
  it('?lang=ar ile açılıp dil FRANSIZCAya değiştirilince Fransızcada KALIR, ar\'a geri dönmez', async () => {
    renderPage('/aydinlatma?lang=ar')

    await waitFor(() => {
      expect(screen.getByText(getLegalDocument('ar').title)).toBeTruthy()
    })
    await waitFor(() => expect(i18n.language).toBe('ar'))

    // Dil seçiciyle değiştirme: useAppLanguage.changeLang → i18n.changeLanguage.
    await act(async () => { await i18n.changeLanguage('fr') })

    await waitFor(() => {
      expect(screen.getByText(getLegalDocument('fr').title)).toBeTruthy()
    })
    // Regresyonun kalbi: bir tur daha render/efekt döngüsü geçtikten sonra
    // Arapçaya GERİ DÖNMEMELİ.
    expect(i18n.language).toBe('fr')
    expect(screen.queryByText(getLegalDocument('ar').title)).toBeNull()
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
  })

  it('?lang=xx (geçersiz kod) Türkçe dokümana düşer', async () => {
    renderPage('/aydinlatma?lang=xx')

    await waitFor(() => {
      expect(screen.getByText(getLegalDocument('tr').title)).toBeTruthy()
    })
  })

  it('?lang= parametresi yokken sayfa aktif i18next dilinde render edilir', async () => {
    await act(async () => { await i18n.changeLanguage('fr') })

    renderPage('/aydinlatma')

    expect(screen.getByText(getLegalDocument('fr').title)).toBeTruthy()
  })

  it('kimlik EKSİKKEN TASLAK bannerı görünür', () => {
    renderPage('/aydinlatma', { identityComplete: false })
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('kimlik TAMAMLANMIŞKEN TASLAK bannerı görünmez', () => {
    renderPage('/aydinlatma', { identityComplete: true })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
