import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { bmi } from '../../domain/health'
import { Card } from '../../components/ui/Card'
import type { RequestRow } from '../../types/db'

function smokingDisplay(req: RequestRow, t: TFunction): string | null {
  if (!req.smoking_status) return null
  const base = t(`newRequest.smoking.${req.smoking_status}`)
  return req.smoking_pack_years != null ? `${base} · ${req.smoking_pack_years} ${t('patientInfo.packYearsUnit')}` : base
}

function alcoholDisplay(req: RequestRow, t: TFunction): string | null {
  if (!req.alcohol_status) return null
  const base = t(`newRequest.alcohol.${req.alcohol_status}`)
  return req.alcohol_drinks_per_week != null ? `${base} · ${req.alcohol_drinks_per_week}${t('patientInfo.weeklyUnit')}` : base
}

const genderLabel: Record<NonNullable<RequestRow['gender']>, string> = {
  female: 'Kadın', male: 'Erkek', other: 'Diğer',
}

function isEmpty(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || value === ''
}

function InfoItem({ label, value, full, numeric, children }: {
  label: string
  value?: string | number | null
  full?: boolean
  numeric?: boolean
  children?: ReactNode
}) {
  const { t } = useTranslation('requests')
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={`text-sm text-ink-primary${numeric ? ' tnum' : ''}`}>
        {children ?? (isEmpty(value) ? <span className="text-ink-muted">{t('patientInfo.notSpecified')}</span> : value)}
      </dd>
    </div>
  )
}

export function PatientInfoCard({ req, patientName, categoryName, subcategoryName, operationName }: {
  req: RequestRow
  patientName: string
  categoryName?: string
  subcategoryName?: string | null
  operationName?: string | null
}) {
  const { t } = useTranslation('requests')
  const bmiValue = req.weight_kg && req.height_cm ? bmi(req.weight_kg, req.height_cm) : null
  const categoryDisplay = [categoryName, subcategoryName].filter(Boolean).join(' / ')
  return (
    <Card title={t('patientInfo.title')}>
      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
        <InfoItem label={t('patientInfo.nameLabel')} value={patientName} />
        <InfoItem label={t('patientInfo.categoryLabel')} value={categoryDisplay || null} />
        <InfoItem label={t('patientInfo.operationLabel')} value={operationName} />
        <InfoItem label={t('patientInfo.ageLabel')} value={req.age} numeric />
        <InfoItem label={t('patientInfo.genderLabel')} value={req.gender ? genderLabel[req.gender] : null} />
        <InfoItem label={t('patientInfo.heightLabel')} value={req.height_cm} numeric />
        <InfoItem label={t('patientInfo.weightLabel')} value={req.weight_kg} numeric />
        <InfoItem label={t('patientInfo.bmiLabel')}>
          {bmiValue === null ? (
            <span className="text-ink-muted">{t('patientInfo.notSpecified')}</span>
          ) : (
            <span className="inline-flex px-2 py-0.5 rounded-full bg-brand-100 text-brand-text text-sm font-medium tnum">
              {bmiValue}
            </span>
          )}
        </InfoItem>
        <InfoItem label={t('patientInfo.pastSurgeriesLabel')} value={req.past_surgeries} full />
        <InfoItem label={t('patientInfo.knownConditionsLabel')} value={req.known_conditions} full />
        <InfoItem label={t('patientInfo.medicationsLabel')} value={req.medications} full />
        <InfoItem label={t('patientInfo.smokingLabel')} value={smokingDisplay(req, t)} />
        <InfoItem label={t('patientInfo.alcoholLabel')} value={alcoholDisplay(req, t)} />
        <InfoItem label={t('patientInfo.notesLabel')} value={req.notes} full />
      </dl>
    </Card>
  )
}
