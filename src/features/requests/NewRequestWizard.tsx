import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useCategories, useSubcategories, useOperationTypes } from '../catalog/useCatalog'
import { useCreateRequest } from './useRequests'
import { PhotoUploader } from '../../components/PhotoUploader'
import { medicalValue } from '../../domain/health'

type Gender = 'female' | 'male' | 'other'

interface MedicalField {
  none: boolean
  text: string
}

const emptyMedical: MedicalField = { none: false, text: '' }

export function NewRequestWizard() {
  const { appUser } = useAuth()
  const nav = useNavigate()
  const cats = useCategories()
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null)
  const [operationTypeId, setOperationTypeId] = useState<string | null>(null)
  const [first, setFirst] = useState(''); const [last, setLast] = useState('')
  const [age, setAge] = useState(''); const [weightKg, setWeightKg] = useState(''); const [heightCm, setHeightCm] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [pastSurgeries, setPastSurgeries] = useState<MedicalField>(emptyMedical)
  const [knownConditions, setKnownConditions] = useState<MedicalField>(emptyMedical)
  const [medications, setMedications] = useState<MedicalField>(emptyMedical)
  const [notes, setNotes] = useState(''); const [files, setFiles] = useState<File[]>([])
  const [xrayFiles, setXrayFiles] = useState<File[]>([])
  const [warn, setWarn] = useState<string | null>(null)
  const subs = useSubcategories(categoryId)
  const ops = useOperationTypes(categoryId, subcategoryId)
  const create = useCreateRequest()

  const selectedCat = cats.data?.find((c) => c.id === categoryId)
  const needsSub = selectedCat?.has_subcategories
  const isDental = selectedCat?.name === 'Diş Tedavisi'

  const ageNum = Number(age); const weightNum = Number(weightKg); const heightNum = Number(heightCm)
  const medicalValid = (m: MedicalField) => m.none || !!m.text.trim()

  const canSubmit = !!first && !!last && ageNum > 0 && weightNum > 0 && heightNum > 0 && !!gender &&
    !!categoryId && (!needsSub || !!subcategoryId) &&
    medicalValid(pastSurgeries) && medicalValid(knownConditions) && medicalValid(medications) &&
    files.length > 0

  const submit = async () => {
    const res = await create.mutateAsync({
      tenantId: appUser!.tenant_id, createdBy: appUser!.id,
      patient: { first_name: first, last_name: last },
      age: ageNum, weightKg: weightNum, heightCm: heightNum, gender: gender as Gender,
      pastSurgeries: medicalValue(pastSurgeries.none, pastSurgeries.text) ?? '',
      knownConditions: medicalValue(knownConditions.none, knownConditions.text) ?? '',
      medications: medicalValue(medications.none, medications.text) ?? '',
      categoryId, subcategoryId: needsSub ? subcategoryId : null,
      operationTypeId, notes, files,
      xrayFiles: isDental ? xrayFiles : undefined,
    })
    if (res.assignedCount === 0) {
      setWarn('Talep kaydedildi ancak bu kategoride uygun aktif doktor bulunamadı; koordinatör atama yapacaktır.')
      return
    }
    nav('/requests')
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Yeni Talep</h2>
      <input className="w-full border rounded p-2" placeholder="Ad" value={first} onChange={(e) => setFirst(e.target.value)} />
      <input className="w-full border rounded p-2" placeholder="Soyad" value={last} onChange={(e) => setLast(e.target.value)} />
      <input className="w-full border rounded p-2" type="number" placeholder="Yaş" value={age} onChange={(e) => setAge(e.target.value)} />
      <input className="w-full border rounded p-2" type="number" placeholder="Boy (cm)" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
      <input className="w-full border rounded p-2" type="number" placeholder="Kilo (kg)" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
      <select className="w-full border rounded p-2" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
        <option value="">Cinsiyet seç…</option>
        <option value="female">Kadın</option>
        <option value="male">Erkek</option>
        <option value="other">Diğer</option>
      </select>
      <select className="w-full border rounded p-2" value={categoryId}
        onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(null); setOperationTypeId(null) }}>
        <option value="">Kategori seç…</option>
        {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {needsSub && (
        <select className="w-full border rounded p-2" value={subcategoryId ?? ''}
          onChange={(e) => setSubcategoryId(e.target.value || null)}>
          <option value="">Alt kırılım seç… (zorunlu)</option>
          {subs.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {categoryId && (
        <select className="w-full border rounded p-2" value={operationTypeId ?? ''}
          onChange={(e) => setOperationTypeId(e.target.value || null)}>
          <option value="">Operasyon tipi (opsiyonel)…</option>
          {ops.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium">Geçmiş ameliyatlar</label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pastSurgeries.none}
            onChange={(e) => setPastSurgeries({ ...pastSurgeries, none: e.target.checked })} />
          Yok
        </label>
        {!pastSurgeries.none && (
          <textarea className="w-full border rounded p-2" placeholder="Geçmiş ameliyatlar"
            value={pastSurgeries.text} onChange={(e) => setPastSurgeries({ ...pastSurgeries, text: e.target.value })} />
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Bilinen hastalıklar</label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={knownConditions.none}
            onChange={(e) => setKnownConditions({ ...knownConditions, none: e.target.checked })} />
          Yok
        </label>
        {!knownConditions.none && (
          <textarea className="w-full border rounded p-2" placeholder="Bilinen hastalıklar"
            value={knownConditions.text} onChange={(e) => setKnownConditions({ ...knownConditions, text: e.target.value })} />
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Düzenli kullanılan ilaçlar</label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={medications.none}
            onChange={(e) => setMedications({ ...medications, none: e.target.checked })} />
          Yok
        </label>
        {!medications.none && (
          <textarea className="w-full border rounded p-2" placeholder="Düzenli kullanılan ilaçlar"
            value={medications.text} onChange={(e) => setMedications({ ...medications, text: e.target.value })} />
        )}
      </div>

      <textarea className="w-full border rounded p-2" placeholder="Not" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <PhotoUploader files={files} onChange={setFiles} />
      {isDental && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Diş röntgeni (opsiyonel)</label>
          <PhotoUploader files={xrayFiles} onChange={setXrayFiles} />
        </div>
      )}
      {warn && <p className="text-amber-700 text-sm">{warn}</p>}
      <button disabled={!canSubmit || create.isPending}
        className="w-full bg-slate-800 text-white rounded p-2 disabled:opacity-40"
        onClick={submit}>{create.isPending ? 'Gönderiliyor…' : 'Gönder'}</button>
    </div>
  )
}
