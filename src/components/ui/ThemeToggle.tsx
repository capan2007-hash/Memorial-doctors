import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../lib/theme'
import { Icon } from './Icon'

/** Açık/koyu tema anahtarı — header'da. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-secondary transition-colors duration-[var(--dur-fast)] ease-premium hover:bg-surface-2 hover:text-ink-primary"
    >
      <Icon of={dark ? Sun : Moon} size={18} />
    </button>
  )
}
