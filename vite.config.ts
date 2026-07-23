import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright E2E (tests/e2e) vitest ile çalıştırılmaz; ayrı `npm run e2e`.
    // mobile/ ayrı bir Expo uygulamasıdır (jest ile test edilir) — kök vitest dokunmaz.
    exclude: ['tests/e2e/**', '**/node_modules/**', 'dist/**', 'mobile/**'],
  },
} as any)
