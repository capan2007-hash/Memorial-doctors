import { test, expect, type Page } from '@playwright/test'

const SALES = { email: process.env.E2E_SALES_EMAIL!, pw: process.env.E2E_SALES_PW! }
const DOCTOR = { email: process.env.E2E_DOCTOR_EMAIL!, pw: process.env.E2E_DOCTOR_PW! }
const COORD = { email: process.env.E2E_COORD_EMAIL!, pw: process.env.E2E_COORD_PW! }

const TS = Date.now()
const PHONE = `05${TS.toString().slice(-9)}` // iki talep aynı telefon → deterministik eşleşme
// Rastgele ALFA soyadlar (zaman damgası rakamı YOK): #1'in birikmiş test kayıtlarıyla
// isim benzerliğiyle yanlışlıkla eşleşip koordinatöre gitmesini önler. #1↔#2 eşleşmesi
// TELEFON üzerinden (aynı PHONE) sağlanır, isme gerek yok.
const LAST_A = `A${Math.random().toString(36).slice(2, 11)}` // 1. talep (doktora gider)
const LAST_B = `B${Math.random().toString(36).slice(2, 11)}` // 2. talep (mükerrer-şüphesi, koordinatöre)

async function login(page: Page, u: { email: string; pw: string }) {
  await page.goto('/login')
  await page.getByLabel('E-posta').fill(u.email)
  await page.getByLabel('Şifre').fill(u.pw)
  await page.getByRole('button', { name: 'Giriş' }).click()
  await expect(page).not.toHaveURL(/login/)
}

async function fillWizard(p: Page, last: string) {
  await p.goto('/requests/new')
  await p.getByLabel('Ad', { exact: true }).fill('Test')
  await p.getByLabel('Soyad').fill(last)
  await p.getByLabel('Telefon').fill(PHONE)
  await p.getByLabel('Yaş', { exact: true }).fill('35')
  await p.getByLabel('Boy', { exact: true }).fill('175')
  await p.getByLabel('Kilo', { exact: true }).fill('80')
  await p.getByLabel('Cinsiyet').selectOption({ label: 'Kadın' })
  await p.getByLabel('Kategori').selectOption({ label: 'Saç Ekimi' })
  const yok = p.getByRole('checkbox', { name: 'Yok' })
  await expect(yok).toHaveCount(3)
  for (let i = 0; i < 3; i++) await yok.nth(i).check()
  await p.getByLabel('Sigara').selectOption({ label: 'Hiç kullanmadı' })
  await p.getByLabel('Alkol').selectOption({ label: 'Hiç' })
  await p.setInputFiles('input[type=file]', 'tests/e2e/fixtures/sample.jpg')
  await p.getByRole('button', { name: 'Gönder' }).click()
}

test('mükerrer talep: 2. başvuru koordinatöre gider, doktor görmez, salınınca doktora düşer', async ({ browser }) => {
  // 1) Satışçı 1. talebi girer → doktora atanır, LİSTEYE döner. (Gevşek /requests/
  // regex'i /requests/new'i de eşlerdi; gerçek navigasyonu beklemek için $ kullan.)
  const salesCtx = await browser.newContext()
  const sales = await salesCtx.newPage()
  await login(sales, SALES)
  await fillWizard(sales, LAST_A)
  await expect(sales).toHaveURL(/\/requests$/)

  // 2) Satışçı AYNI telefonla 2. talebi girer → mükerrer-şüphesi uyarısı, nav YOK.
  await fillWizard(sales, LAST_B)
  await expect(sales.getByText(/Bu hastanın aktif bir talebi var/)).toBeVisible()
  await expect(sales).toHaveURL(/\/requests\/new$/)

  // 3) Doktor 2. talebi (LAST_B) GÖRMEZ; 1. talebi (LAST_A) görür.
  const docCtx = await browser.newContext()
  const doc = await docCtx.newPage()
  await login(doc, DOCTOR)
  await doc.goto('/doctor')
  await expect(doc.getByRole('link', { name: new RegExp(LAST_A) }).first()).toBeVisible()
  await expect(doc.getByRole('link', { name: new RegExp(LAST_B) })).toHaveCount(0)

  // 4) Koordinatör Mükerrer Talep kuyruğunda 2. talebi görür (görsel doğrulama).
  const coordCtx = await browser.newContext()
  const coord = await coordCtx.newPage()
  await coord.setViewportSize({ width: 1280, height: 1200 })
  await login(coord, COORD)
  await coord.goto('/admin/duplicates')
  const card = coord.locator('div').filter({ hasText: new RegExp(`Test ${LAST_B}`) }).first()
  await expect(coord.getByText(new RegExp(`Test ${LAST_B}`)).first()).toBeVisible()
  await coord.screenshot({ path: 'tests/e2e/_dup-coord-light.png', fullPage: true })
  await coord.getByRole('button', { name: /tema/i }).click().catch(() => {})
  await coord.waitForTimeout(400)
  await coord.screenshot({ path: 'tests/e2e/_dup-coord-dark.png', fullPage: true })
  await coord.getByRole('button', { name: /tema/i }).click().catch(() => {})

  // 5) Koordinatör "Mükerrer değil — doktorlara gönder" der → dismissed + atama.
  await coord.getByRole('button', { name: /Mükerrer değil/ }).first().click()
  await expect(coord.getByText(new RegExp(`Test ${LAST_B}`))).toHaveCount(0)

  // 6) Doktor artık 2. talebi (LAST_B) görür.
  await doc.goto('/doctor')
  await expect(doc.getByRole('link', { name: new RegExp(LAST_B) }).first()).toBeVisible()

  await salesCtx.close()
  await docCtx.close()
  await coordCtx.close()
})
