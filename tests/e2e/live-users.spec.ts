import { test, expect, type Page } from '@playwright/test'

const COORD = { email: process.env.E2E_COORD_EMAIL!, pw: process.env.E2E_COORD_PW! }

async function login(page: Page, u: { email: string; pw: string }) {
  await page.goto('/login')
  await page.getByLabel('E-posta').fill(u.email)
  await page.getByLabel('Şifre').fill(u.pw)
  await page.getByRole('button', { name: 'Giriş' }).click()
  await expect(page).not.toHaveURL(/login/)
}

test('kullanıcı yönetimi ekranı + yeni kullanıcı dialogu (iki tema)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 })
  await login(page, COORD)
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Kullanıcı Yönetimi' })).toBeVisible()
  await expect(page.getByText('sales@rememore.test')).toBeVisible()
  await page.screenshot({ path: 'tests/e2e/_users-list.png', fullPage: true })

  // Yeni kullanıcı dialogu — rol açılırında koordinatörün izinli rolleri (Satışçı/Aracı)
  await page.getByRole('button', { name: /Yeni Kullanıcı/ }).click()
  await expect(page.getByRole('heading', { name: 'Yeni Kullanıcı' })).toBeVisible()
  await page.screenshot({ path: 'tests/e2e/_users-dialog.png' })
  await page.keyboard.press('Escape').catch(() => {})

  // Login "Şifremi unuttum" akışı
  await page.goto('/login')
  await page.getByRole('button', { name: 'Şifremi unuttum?' }).click()
  await expect(page.getByRole('heading', { name: 'Şifre sıfırla' })).toBeVisible()
  await page.screenshot({ path: 'tests/e2e/_forgot.png' })
})
