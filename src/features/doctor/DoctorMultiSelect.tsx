import { useTranslation } from 'react-i18next'
import { Stethoscope } from 'lucide-react'
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown'

export interface SelectableDoctor {
  id: string
  name: string
  specialty: string | null
}

/** Doktor çoklu seçimi — ortak MultiSelectDropdown üzerine ince sarmalayıcı. */
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
  return (
    <MultiSelectDropdown
      options={doctors.map((d) => ({ id: d.id, label: d.name, hint: d.specialty }))}
      value={value}
      onChange={onChange}
      placeholder={t('newRequest.routing.pickPlaceholder')}
      summaryLabel={(count) => t('newRequest.routing.pickedCount', { count })}
      emptyLabel={t('newRequest.routing.noEligible')}
      loadingLabel={t('newRequest.routing.loading')}
      loading={loading}
      disabled={disabled}
      icon={Stethoscope}
    />
  )
}
