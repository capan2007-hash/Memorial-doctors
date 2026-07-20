import { test, expect, type Page } from '@playwright/test'

const COORD = { email: process.env.E2E_COORD_EMAIL!, pw: process.env.E2E_COORD_PW! }
const NEW_EMAIL = `e2e-user-${Date.now()}@rememore.test`
const NEW_PW = 'E2eUser2026!'

async function login(page: Page, u: { email: string; pw: string }) {
  await page.goto('/login')
  await page.getByLabel('E-posta').fill(u.email)
  await page.getByLabel('Şifre').fill(u.pw)
  await page.getByRole('button', { name: 'Giriş' }).click()
  await expect(page).not.toHaveURL(/login/)
}

test('koordinatör satışçı kullanıcı oluşturur, yeni kullanıcı giriş yapar', async ({ browser }) => {
  // 1) Koordinatör Kullanıcı Yönetimi'nden yeni satışçı oluşturur.
  const coordCtx = await browser.newContext()
  const coord = await coordCtx.newPage()
  await login(coord, COORD)
  await coord.goto('/admin/users')
  await coord.getByRole('button', { name: /Yeni Kullanıcı/ }).click()
  await coord.getByLabel('E-posta').fill(NEW_EMAIL)
  await coord.getByLabel('Ad Soyad').fill('E2E Satışçı')
  await coord.getByLabel('Rol').selectOption({ label: 'Satışçı' })
  await coord.getByLabel('Geçici şifre').fill(NEW_PW)
  await coord.getByRole('button', { name: 'Oluştur' }).click()
  // Dialog kapanınca (edge fn cold start birkaç sn sürebilir) listede görünür.
  await expect(coord.getByRole('heading', { name: 'Yeni Kullanıcı' })).toHaveCount(0, { timeout: 20000 })
  await expect(coord.getByText(NEW_EMAIL)).toBeVisible({ timeout: 10000 })

  // 2) Yeni satışçı giriş yapabilir (talep listesine düşer).
  const userCtx = await browser.newContext()
  const user = await userCtx.newPage()
  await login(user, { email: NEW_EMAIL, pw: NEW_PW })
  await expect(user).toHaveURL(/\/requests/)

  await coordCtx.close()
  await userCtx.close()
})
