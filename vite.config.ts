import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright E2E (tests/e2e) vitest ile çalıştırılmaz; ayrı `npm run e2e`.
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
} as any)
