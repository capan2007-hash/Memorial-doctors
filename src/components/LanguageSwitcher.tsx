import { Check } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/shadcn/dropdown-menu'
import { useAppLanguage } from '../i18n/useAppLanguage'
import { SUPPORTED, type Lang } from '../i18n'

const LANG_LABELS: Record<Lang, string> = {
  tr: 'Türkçe',
  ar: 'العربية',
  en: 'English',
  ru: 'Русский',
  de: 'Deutsch',
  fr: 'Français',
}

const LANG_FLAGS: Record<Lang, string> = {
  tr: '🇹🇷',
  ar: '🇸🇦',
  en: '🇬🇧',
  ru: '🇷🇺',
  de: '🇩🇪',
  fr: '🇫🇷',
}

/** Dil seçici — header'da ThemeToggle yanında. Tetikleyici buton aktif dilin bayrağını gösterir. */
export function LanguageSwitcher() {
  const { lang, changeLang } = useAppLanguage()
  const activeFlag = LANG_FLAGS[(lang as Lang)] ?? LANG_FLAGS.tr

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Dil seçimi"
          className="inline-flex h-9 w-9 items-center justify-center rounded-control text-lg leading-none text-ink-secondary transition-colors duration-[var(--dur-fast)] ease-premium hover:bg-surface-2 hover:text-ink-primary"
        >
          <span aria-hidden="true">{activeFlag}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED.map((code) => (
          <DropdownMenuItem key={code} onClick={() => changeLang(code)}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span aria-hidden="true">{LANG_FLAGS[code]}</span>
                {LANG_LABELS[code]}
              </span>
              {lang === code && <Check className="h-4 w-4" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
