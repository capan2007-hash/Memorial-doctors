// Klinik Güven tema tokenları (bkz. docs/superpowers/specs/2026-07-18-medtriage-m6a-doktor-app-design.md).
export const colors = {
  brand: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    600: '#0F766E',
    700: '#115E59',
  },
  accent: {
    100: '#FEF3C7',
    600: '#D97706',
    700: '#B45309',
  },
  surface: '#F8FAFC',
  card: '#FFFFFF',
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  danger: {
    100: '#FEE2E2',
    600: '#DC2626',
    700: '#B91C1C',
  },
} as const

export const spacing = {
  half: 4,
  one: 8,
  two: 12,
  three: 16,
  four: 24,
  five: 32,
  six: 48,
} as const

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const

export const fontFamily = {
  display: 'Fraunces_600SemiBold',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const
