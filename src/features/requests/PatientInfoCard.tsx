import type { ReactNode } from 'react'
import { bmi } from '../../domain/health'
import { Card } from '../../components/ui/Card'
import type { RequestRow } from '../../types/db'

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
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={`text-sm text-ink-primary${numeric ? ' tnum' : ''}`}>
        {children ?? (isEmpty(value) ? <span className="text-ink-muted">Belirtilmedi</span> : value)}
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
  const bmiValue = req.weight_kg && req.height_cm ? bmi(req.weight_kg, req.height_cm) : null
  const categoryDisplay = [categoryName, subcategoryName].filter(Boolean).join(' / ')
  return (
    <Card title="Hasta Bilgileri">
      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
        <InfoItem label="Hasta adı" value={patientName} />
        <InfoItem label="Kategori" value={categoryDisplay || null} />
        <InfoItem label="İstenen operasyon" value={operationName} />
        <InfoItem label="Yaş" value={req.age} numeric />
        <InfoItem label="Cinsiyet" value={req.gender ? genderLabel[req.gender] : null} />
        <InfoItem label="Boy (cm)" value={req.height_cm} numeric />
        <InfoItem label="Kilo (kg)" value={req.weight_kg} numeric />
        <InfoItem label="BMI">
          {bmiValue === null ? (
            <span className="text-ink-muted">Belirtilmedi</span>
          ) : (
            <span className="inline-flex px-2 py-0.5 rounded-full bg-brand-100 text-brand-text text-sm font-medium tnum">
              {bmiValue}
            </span>
          )}
        </InfoItem>
        <InfoItem label="Geçmiş ameliyatlar" value={req.past_surgeries} full />
        <InfoItem label="Bilinen hastalıklar" value={req.known_conditions} full />
        <InfoItem label="Düzenli ilaçlar" value={req.medications} full />
        <InfoItem label="Not" value={req.notes} full />
      </dl>
    </Card>
  )
}
