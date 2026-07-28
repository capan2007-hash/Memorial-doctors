import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Stethoscope } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { Icon } from '../../components/ui/Icon'

export interface SelectableDoctor {
  id: string
  name: string
  specialty: string | null
}

/**
 * Doktor çoklu seçimi (açılır liste). Çip yığını yerine tek satırlık tetikleyici +
 * içinde işaretlenebilir liste: seçili doktorun yanında yeşil tik görünür.
 * Liste açık kalır (çoklu seçim) — her tık yalnız o doktoru açar/kapatır.
 */
export function DoctorMultiSelect({
  doctors,
  value,
  onChange,
  loading,
  disabled,
}: {
  doctors: SelectableDoctor[]
  value: string[]
  onChange: (ids: string[]) => void
  loading?: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation('requests')
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  const selectedNames = doctors.filter((d) => value.includes(d.id)).map((d) => d.name)
  const label =
    selectedNames.length === 0
      ? t('newRequest.routing.pickPlaceholder')
      : selectedNames.length <= 2
        ? selectedNames.join(', ')
        : t('newRequest.routing.pickedCount', { count: selectedNames.length })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || loading}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-control border border-line bg-surface-1 px-3 py-2 text-start text-sm text-ink-primary transition hover:border-line-strong disabled:opacity-50"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Icon of={Stethoscope} size={15} className="shrink-0 text-ink-muted" />
            <span className={`truncate ${selectedNames.length ? '' : 'text-ink-muted'}`}>
              {loading ? t('newRequest.routing.loading') : label}
            </span>
          </span>
          <Icon of={ChevronDown} size={15} className="shrink-0 text-ink-muted" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="max-h-72 w-[--radix-dropdown-menu-trigger-width] min-w-56 overflow-y-auto">
        {doctors.length === 0 ? (
          <div className="px-2 py-3 text-sm text-ink-muted">{t('newRequest.routing.noEligible')}</div>
        ) : (
          doctors.map((d) => {
            const checked = value.includes(d.id)
            return (
              <DropdownMenuCheckboxItem
                key={d.id}
                checked={checked}
                // Seçimden sonra liste AÇIK kalsın (birden fazla doktor seçilebilsin).
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => toggle(d.id)}
                className="gap-2 py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-ink-primary">{d.name}</span>
                  {d.specialty && <span className="truncate text-xs text-ink-muted">{d.specialty}</span>}
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
