import { Check, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { Icon } from './Icon'

export interface MultiSelectOption {
  id: string
  label: string
  /** İkinci satır (branş, açıklama vb.) */
  hint?: string | null
}

/**
 * Çoklu seçim açılır listesi: seçili öğenin yanında yeşil tik, liste seçimden sonra
 * AÇIK kalır (arka arkaya birden fazla seçilebilsin). Doktor seçimi ve katalog
 * (alt kategori) seçimi aynı bileşeni kullanır.
 */
export function MultiSelectDropdown({
  options,
  value,
  onChange,
  placeholder,
  summaryLabel,
  emptyLabel,
  loadingLabel,
  loading,
  disabled,
  icon,
}: {
  options: MultiSelectOption[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder: string
  /** 3+ seçimde gösterilecek özet (ör. "4 işlem seçildi") */
  summaryLabel: (count: number) => string
  emptyLabel: string
  loadingLabel?: string
  loading?: boolean
  disabled?: boolean
  icon?: LucideIcon
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  const selected = options.filter((o) => value.includes(o.id)).map((o) => o.label)
  const label =
    selected.length === 0 ? placeholder : selected.length <= 2 ? selected.join(', ') : summaryLabel(selected.length)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || loading}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-control border border-line bg-surface-1 px-3 py-2 text-start text-sm text-ink-primary transition hover:border-line-strong disabled:opacity-50"
        >
          <span className="flex min-w-0 items-center gap-2">
            {icon && <Icon of={icon} size={15} className="shrink-0 text-ink-muted" />}
            <span className={`truncate ${selected.length ? '' : 'text-ink-muted'}`}>
              {loading ? loadingLabel ?? placeholder : label}
            </span>
          </span>
          <Icon of={ChevronDown} size={15} className="shrink-0 text-ink-muted" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="max-h-72 w-[--radix-dropdown-menu-trigger-width] min-w-56 overflow-y-auto">
        {options.length === 0 ? (
          <div className="px-2 py-3 text-sm text-ink-muted">{emptyLabel}</div>
        ) : (
          options.map((o) => {
            const checked = value.includes(o.id)
            return (
              <DropdownMenuCheckboxItem
                key={o.id}
                checked={checked}
                // Seçimden sonra liste açık kalsın (çoklu seçim).
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => toggle(o.id)}
                className="gap-2 py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-ink-primary">{o.label}</span>
                  {o.hint && <span className="truncate text-xs text-ink-muted">{o.hint}</span>}
                </span>
                {checked && <Icon of={Check} size={15} className="shrink-0 text-success-text" />}
              </DropdownMenuCheckboxItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
