import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Rafine Klinik token'ları (CSS değişkenlerinden — açık/koyu otomatik).
        surface: {
          DEFAULT: 'var(--surface-0)',
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          card: 'var(--surface-2)',
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          invert: 'var(--text-invert)',
        },
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          on: 'var(--on-brand)',
          fill: 'var(--brand-fill)',
          'fill-hover': 'var(--brand-fill-hover)',
          text: 'var(--brand-text)',
        },
        success: { bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success-text)' },
        warning: { bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning-text)' },
        danger: { bg: 'var(--danger-bg)', border: 'var(--danger-border)', text: 'var(--danger-text)' },
        info: { bg: 'var(--info-bg)', border: 'var(--info-border)', text: 'var(--info-text)' },
        // Eski accent (amber, 100/600/700) korunur + shadcn accent (DEFAULT/foreground) birleşik.
        accent: {
          100: 'var(--warning-bg)',
          600: 'var(--warning-text)',
          700: 'var(--warning-text)',
          DEFAULT: 'hsl(var(--sc-accent) / <alpha-value>)',
          foreground: 'hsl(var(--sc-accent-foreground) / <alpha-value>)',
        },
        // --- shadcn/ui token'ları (izole; --sc-* önekli, mevcut Rafine Klinik temasına dokunmaz) ---
        background: 'hsl(var(--sc-background) / <alpha-value>)',
        foreground: 'hsl(var(--sc-foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--sc-primary) / <alpha-value>)',
          foreground: 'hsl(var(--sc-primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--sc-secondary) / <alpha-value>)',
          foreground: 'hsl(var(--sc-secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--sc-muted) / <alpha-value>)',
          foreground: 'hsl(var(--sc-muted-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--sc-destructive) / <alpha-value>)',
          foreground: 'hsl(var(--sc-destructive-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--sc-card) / <alpha-value>)',
          foreground: 'hsl(var(--sc-card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--sc-popover) / <alpha-value>)',
          foreground: 'hsl(var(--sc-popover-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--sc-border) / <alpha-value>)',
        input: 'hsl(var(--sc-input) / <alpha-value>)',
        ring: 'hsl(var(--sc-ring) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
        // shadcn radius (0.5rem taban → tailwind varsayılan lg/md/sm ile birebir aynı).
        lg: 'var(--sc-radius)',
        md: 'calc(var(--sc-radius) - 2px)',
        sm: 'calc(var(--sc-radius) - 4px)',
      },
      transitionTimingFunction: {
        premium: 'var(--ease-out)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
