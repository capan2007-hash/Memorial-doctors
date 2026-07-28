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
    // .claude/worktrees/ altındaki git worktree'leri repo İÇİNDE tam birer checkout
    // taşır; dışlanmazsa kök vitest onların spec'lerini de toplar ve tsconfig'i
    // çözemediği için "Tsconfig not found" ile dosya düzeyinde patlar.
    // Desenler `**/` ile başlar: kök-göreli `mobile/**` gibi desenler iç içe
    // kopyalarda (`.claude/worktrees/<ad>/mobile/...`) eşleşmez.
    exclude: ['**/tests/e2e/**', '**/node_modules/**', 'dist/**', '**/mobile/**', '.claude/**'],
  },
} as any)
