import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

// Playwright .env.local'ı otomatik yüklemez; bağımlılıksız şekilde okuyup process.env'e yazıyoruz.
// Not: package.json "type": "module" olduğundan __dirname yok; process.cwd() kullanılır
// (playwright test her zaman config dosyasının bulunduğu kök dizinden çalıştırılır).
function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
loadDotEnvLocal()

export default defineConfig({
  testDir: './tests/e2e',
  // Gerçek (uzak) Supabase'e karşı çalışır: auth + foto yükleme + storage
  // round-trip'leri varsayılan 30s'i aşabilir, bu yüzden süreleri genişletiyoruz.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://localhost:5190', actionTimeout: 15_000 },
  webServer: {
    command: 'npm run dev -- --port 5190 --strictPort',
    url: 'http://localhost:5190',
    reuseExistingServer: true,
  },
})
