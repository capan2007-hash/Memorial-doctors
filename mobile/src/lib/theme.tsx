import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Appearance } from 'react-native'

import { darkColors, lightColors, type Palette } from '@/theme'

type Mode = 'light' | 'dark'
interface ThemeValue {
  mode: Mode
  colors: Palette
  toggle: () => void
}
const Ctx = createContext<ThemeValue | null>(null)
const STORAGE_KEY = 'medtriage-theme'

/** Açık/koyu tema — sistem tercihiyle başlar, seçim AsyncStorage'da tutulur. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'))

  useEffect(() => {
    let active = true
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (active && (stored === 'light' || stored === 'dark')) setMode(stored)
    })
    return () => {
      active = false
    }
  }, [])

  const toggle = () => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark'
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
      return next
    })
  }

  return (
    <Ctx.Provider value={{ mode, colors: mode === 'dark' ? darkColors : lightColors, toggle }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme ThemeProvider içinde kullanılmalı')
  return v
}
