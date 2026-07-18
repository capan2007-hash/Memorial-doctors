import { bmi } from '../../domain/health'
import type { RequestRow } from '../../types/db'

const genderLabel: Record<NonNullable<RequestRow['gender']>, string> = {
  female: 'Kadın', male: 'Erkek', other: 'Diğer',
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm">{value === null || value === undefined || value === '' ? '—' : value}</dd>
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
    <div className="border rounded p-3 bg-white space-y-3">
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Hasta adı" value={patientName} />
        <Field label="Kategori" value={categoryDisplay || '—'} />
        <Field label="İstenen operasyon" value={operationName || '—'} />
        <Field label="Yaş" value={req.age} />
        <Field label="Cinsiyet" value={req.gender ? genderLabel[req.gender] : null} />
        <Field label="Boy (cm)" value={req.height_cm} />
        <Field label="Kilo (kg)" value={req.weight_kg} />
        <Field label="BMI" value={bmiValue} />
      </dl>
      <dl className="space-y-2">
        <Field label="Geçmiş ameliyatlar" value={req.past_surgeries} />
        <Field label="Bilinen hastalıklar" value={req.known_conditions} />
        <Field label="Düzenli ilaçlar" value={req.medications} />
        <Field label="Not" value={req.notes} />
      </dl>
    </div>
  )
}
