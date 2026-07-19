import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
interface ThemeValue {
  theme: Theme
  toggle: () => void
}
const Ctx = createContext<ThemeValue | null>(null)
const STORAGE_KEY = 'medtriage-theme'

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Açık/koyu tema — data-theme'i <html>'e yazar, tercih localStorage'da tutulur. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme ThemeProvider içinde kullanılmalı')
  return v
}
