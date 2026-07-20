// Rafine Klinik — mobil tema. İki palet (açık/koyu); spacing/radius/font tema-bağımsız.
// Web token'larıyla (src/styles/tokens.css) hizalı. Renk erişimi useTheme() üzerinden.

export interface Palette {
  surface0: string
  surface1: string
  surface2: string
  surface3: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textInvert: string
  border: string
  borderStrong: string
  brandFill: string
  brandFillHover: string
  brandOn: string
  brandText: string
  successBg: string
  successBorder: string
  successText: string
  warningBg: string
  warningBorder: string
  warningText: string
  dangerBg: string
  dangerBorder: string
  dangerText: string
  infoBg: string
  infoBorder: string
  infoText: string
}

export const lightColors: Palette = {
  surface0: '#F5F7F5',
  surface1: '#FFFFFF',
  surface2: '#FFFFFF',
  surface3: '#FFFFFF',
  textPrimary: '#14201D',
  textSecondary: '#566661',
  textMuted: '#8A9691',
  textInvert: '#F5F7F5',
  border: '#E4E8E5',
  borderStrong: '#CDD5D1',
  brandFill: '#0F766E',
  brandFillHover: '#115E59',
  brandOn: '#FFFFFF',
  brandText: '#115E59',
  successBg: '#E3F4EC',
  successBorder: '#A9DCC4',
  successText: '#0F6E56',
  warningBg: '#FBEED9',
  warningBorder: '#F0CD93',
  warningText: '#B45309',
  dangerBg: '#FBE7EA',
  dangerBorder: '#F0B6BF',
  dangerText: '#B4243A',
  infoBg: '#E8EEF6',
  infoBorder: '#B4C9E2',
  infoText: '#2C5788',
}

export const darkColors: Palette = {
  surface0: '#0E1513',
  surface1: '#14201D',
  surface2: '#1A2825',
  surface3: '#21322E',
  textPrimary: '#EAF0ED',
  textSecondary: '#9DB0AA',
  textMuted: '#6E827C',
  textInvert: '#0E1513',
  border: '#26352F',
  borderStrong: '#33453E',
  brandFill: '#12897A',
  brandFillHover: '#0F766E',
  brandOn: '#FFFFFF',
  brandText: '#55C7B5',
  successBg: '#102B22',
  successBorder: '#1F4D3F',
  successText: '#6FD6B3',
  warningBg: '#2E2410',
  warningBorder: '#5A4413',
  warningText: '#F0B45F',
  dangerBg: '#2E1418',
  dangerBorder: '#5A2530',
  dangerText: '#F0919F',
  infoBg: '#16212E',
  infoBorder: '#2A3F57',
  infoText: '#9DC0E6',
}

export type Role = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

/** Rolü palet renklerine çözer (bg/border/text). neutral = yüzey + ikincil metin. */
export function roleColors(c: Palette, role: Role): { bg: string; border: string; text: string } {
  switch (role) {
    case 'success':
      return { bg: c.successBg, border: c.successBorder, text: c.successText }
    case 'warning':
      return { bg: c.warningBg, border: c.warningBorder, text: c.warningText }
    case 'danger':
      return { bg: c.dangerBg, border: c.dangerBorder, text: c.dangerText }
    case 'info':
      return { bg: c.infoBg, border: c.infoBorder, text: c.infoText }
    case 'brand':
      return { bg: c.brandFill, border: c.brandFill, text: c.brandOn }
    default:
      return { bg: c.surface2, border: c.border, text: c.textSecondary }
  }
}

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
  sm: 8,
  md: 12,
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
