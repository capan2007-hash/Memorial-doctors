import { test, expect, type Page } from '@playwright/test'

// Seed kullanıcı kimlikleri env'den (E2E_SALES_EMAIL vb.), playwright.config.ts .env.local'ı yükler.
const SALES = { email: process.env.E2E_SALES_EMAIL!, pw: process.env.E2E_SALES_PW! }
const DOCTOR = { email: process.env.E2E_DOCTOR_EMAIL!, pw: process.env.E2E_DOCTOR_PW! }
const AGENT = { email: process.env.E2E_AGENT_EMAIL!, pw: process.env.E2E_AGENT_PW! }

// Her koşuda ayırt edici olması için zaman damgalı hasta soyadı.
const SURNAME = `Hasta${Date.now()}`
const PLAN_TEXT = `Önerilen: FUE 3000 greft (${Date.now()})`

async function login(page: Page, u: { email: string; pw: string }) {
  await page.goto('/login')
  await page.getByLabel('E-posta').fill(u.email)
  await page.getByLabel('Şifre').fill(u.pw)
  await page.getByRole('button', { name: 'Giriş' }).click()
  await expect(page).not.toHaveURL(/login/)
}

test('satışçı talep girer, doktor kabul eder, satışçı planı görür; aracı göremez', async ({ browser }) => {
  // 1) Satışçı talep girer
  const salesCtx = await browser.newContext()
  const sales = await salesCtx.newPage()
  await login(sales, SALES)
  await sales.goto('/requests/new')
  // 'Ad' alt dizge olarak 'Soyad' etiketiyle de eşleşir (Playwright getByLabel
  // varsayılan substring/case-insensitive eşleşme yapar) — exact:true zorunlu.
  await sales.getByLabel('Ad', { exact: true }).fill('Test')
  await sales.getByLabel('Soyad').fill(SURNAME)
  await sales.getByLabel('Yaş').fill('35')
  await sales.getByLabel('Boy').fill('175')
  await sales.getByLabel('Kilo').fill('80')
  // Field sarmalı select'ler artık implicit <label> ile bulunuyor; pozisyonel
  // nth() kalktı. Operasyon tipi select'i kategori seçilene kadar render
  // edilmediği için bu adımda yok.
  await sales.getByLabel('Cinsiyet').selectOption({ label: 'Kadın' })
  await sales.getByLabel('Kategori').selectOption({ label: 'Saç Ekimi' })
  // Geçmiş ameliyatlar / Bilinen hastalıklar / Düzenli kullanılan ilaçlar — üçü de "Yok" ile geçilir.
  const yokCheckboxes = sales.getByRole('checkbox', { name: 'Yok' })
  await expect(yokCheckboxes).toHaveCount(3)
  for (let i = 0; i < 3; i++) {
    await yokCheckboxes.nth(i).check()
  }
  await sales.setInputFiles('input[type=file]', 'tests/e2e/fixtures/sample.jpg')
  await sales.getByRole('button', { name: 'Gönder' }).click()
  await expect(sales).toHaveURL(/requests/)

  // Yeni oluşturulan talebin ID'sini yakala. Liste created_at desc sıralı,
  // bu koşunun talebi her zaman ilk sırada (bu seçici tüm koşularda güvenilir
  // bulundu). ID, doktor adımında talebi kesin biçimde hedeflemek için kullanılır:
  // DoctorQueue geçmiş koşulardan kalan (yanıtlanmış/yanıtlanmamış) talepleri de
  // listelediğinden, kuyruktaki "Aç" bağlantısını sırasına güvenerek tıklamak
  // birden çok bekleyen kayıt olduğunda yanlış talebi açabiliyordu.
  await sales.getByRole('link', { name: new RegExp(SURNAME) }).first().click()
  await expect(sales).toHaveURL(/\/requests\/[0-9a-fA-F-]{36}/)
  const requestId = sales.url().split('/').pop()!

  // 2) Doktor kabul eder — kuyruk sayfasını da (Bekleyen Talepler; satırın
  // kendisi artık talebe giden link) görsel olarak doğrula, ardından yanıtı
  // doğrudan bu talebin ID'si üzerinden ver.
  const docCtx = await browser.newContext()
  const doc = await docCtx.newPage()
  await login(doc, DOCTOR)
  await doc.goto('/doctor')
  await expect(doc.locator('a[href^="/doctor/request/"]').first()).toBeVisible()
  await doc.goto(`/doctor/request/${requestId}`)
  await doc.getByRole('button', { name: 'Kabul' }).click()
  await doc.getByLabel('Tedavi planı').fill(PLAN_TEXT)
  await doc.getByRole('button', { name: 'Kabul et' }).click()
  await expect(doc.getByRole('button', { name: 'Kabul et' })).toHaveCount(0)

  // 3) Satışçı planı görür
  await sales.goto('/requests')
  await sales.getByRole('link', { name: new RegExp(SURNAME) }).first().click()
  await expect(sales).toHaveURL(new RegExp(requestId))
  await expect(sales.getByText(PLAN_TEXT)).toBeVisible()

  // 4) Aracı planı GÖREMEZ (FR-21 izin sınırı)
  const agentCtx = await browser.newContext()
  const agent = await agentCtx.newPage()
  await login(agent, AGENT)
  await agent.goto('/requests')
  // aracının kendi talebi yoksa liste boş; plan metni hiçbir şekilde görünmez
  await expect(agent.getByText(PLAN_TEXT)).toHaveCount(0)

  await salesCtx.close()
  await docCtx.close()
  await agentCtx.close()
})
