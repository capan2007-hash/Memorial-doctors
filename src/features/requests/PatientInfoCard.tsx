import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { bmi } from '../../domain/health'
import { Card } from '../../components/ui/Card'
import { TranslatedText } from '../i18n-content/TranslatedText'
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

function genderDisplay(req: RequestRow, t: TFunction): string | null {
  if (!req.gender) return null
  return t(`newRequest.gender.${req.gender}`)
}

function isEmpty(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || value === ''
}

/** Hasta serbest-metin girdisi (Faz 3): boşsa sabit-UI yer tutucu, doluysa görüntüleyen-diline çevrilir. */
function FreeText({ value, sourceLang, t }: { value: string | null | undefined; sourceLang: string; t: TFunction }) {
  if (isEmpty(value)) return <span className="text-ink-muted">{t('patientInfo.notSpecified')}</span>
  return <TranslatedText text={value} sourceLang={sourceLang} as="span" />
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

export function PatientInfoCard({ req, patientName, categoryName, subcategoryName, operationName, procedureNames }: {
  req: RequestRow
  patientName: string
  categoryName?: string
  subcategoryName?: string | null
  operationName?: string | null
  /** Katalog v2: talepte seçili tüm işlemler. Doluysa tekil alt kategori/işlem tipi yerine bu gösterilir. */
  procedureNames?: string[]
}) {
  const { t } = useTranslation('requests')
  const bmiValue = req.weight_kg && req.height_cm ? bmi(req.weight_kg, req.height_cm) : null
  const hasProcedures = (procedureNames?.length ?? 0) > 0
  // Çoklu işlem varsa kategori satırı yalnız ana kategoriyi gösterir; işlemler ayrı satırda rozet olarak.
  const categoryDisplay = hasProcedures
    ? categoryName ?? ''
    : [categoryName, subcategoryName].filter(Boolean).join(' / ')
  return (
    <Card title={t('patientInfo.title')}>
      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
        <InfoItem label={t('patientInfo.nameLabel')} value={patientName} />
        <InfoItem label={t('patientInfo.categoryLabel')} value={categoryDisplay || null} />
        {hasProcedures ? (
          <InfoItem label={t('patientInfo.proceduresLabel')} full>
            <span className="flex flex-wrap gap-1.5 pt-0.5">
              {procedureNames!.map((name) => (
                <span
                  key={name}
                  className="inline-flex rounded-full border border-brand-200 bg-brand-100 px-2 py-0.5 text-sm font-medium text-brand-text"
                >
                  {name}
                </span>
              ))}
            </span>
          </InfoItem>
        ) : (
          <InfoItem label={t('patientInfo.operationLabel')} value={operationName} />
        )}
        <InfoItem label={t('patientInfo.ageLabel')} value={req.age} numeric />
        <InfoItem label={t('patientInfo.genderLabel')} value={genderDisplay(req, t)} />
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
        <InfoItem label={t('patientInfo.pastSurgeriesLabel')} full>
          <FreeText value={req.past_surgeries} sourceLang={req.source_lang} t={t} />
        </InfoItem>
        <InfoItem label={t('patientInfo.knownConditionsLabel')} full>
          <FreeText value={req.known_conditions} sourceLang={req.source_lang} t={t} />
        </InfoItem>
        <InfoItem label={t('patientInfo.medicationsLabel')} full>
          <FreeText value={req.medications} sourceLang={req.source_lang} t={t} />
        </InfoItem>
        <InfoItem label={t('patientInfo.smokingLabel')} value={smokingDisplay(req, t)} />
        <InfoItem label={t('patientInfo.alcoholLabel')} value={alcoholDisplay(req, t)} />
        <InfoItem label={t('patientInfo.notesLabel')} full>
          <FreeText value={req.notes} sourceLang={req.source_lang} t={t} />
        </InfoItem>
      </dl>
    </Card>
  )
}
