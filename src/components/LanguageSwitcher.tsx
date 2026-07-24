import { Languages, Check } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/shadcn/dropdown-menu'
import { useAppLanguage } from '../i18n/useAppLanguage'
import { SUPPORTED, type Lang } from '../i18n'
import { Icon } from './ui/Icon'

const LANG_LABELS: Record<Lang, string> = {
  tr: 'Türkçe',
  ar: 'العربية',
  en: 'English',
}

/** Dil seçici — header'da ThemeToggle yanında. */
export function LanguageSwitcher() {
  const { lang, changeLang } = useAppLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Dil seçimi"
          className="inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-secondary transition-colors duration-[var(--dur-fast)] ease-premium hover:bg-surface-2 hover:text-ink-primary"
        >
          <Icon of={Languages} size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED.map((code) => (
          <DropdownMenuItem key={code} onClick={() => changeLang(code)}>
            <span className="flex w-full items-center justify-between gap-2">
              {LANG_LABELS[code]}
              {lang === code && <Check className="h-4 w-4" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
