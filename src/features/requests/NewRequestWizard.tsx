import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useCategories, useSubcategories, useOperationTypes } from '../catalog/useCatalog'
import { useCreateRequest } from './useRequests'
import { PhotoUploader } from '../../components/PhotoUploader'
import { medicalValue, demographicsError } from '../../domain/health'
import { normalizePhone } from '../../domain/phone'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { saveDraft, loadDraft, clearDraft, isDraftEmpty, type RequestDraft } from './requestDraft'
import { missingFields } from './missingFields'
import { DuplicateMatchPanel, type MatchRow } from './DuplicateMatchPanel'

const inputClass = 'w-full rounded-lg border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-brand-600'

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
  const [initialDraft] = useState<RequestDraft | null>(() => loadDraft())
  const [draftRestored, setDraftRestored] = useState(!!initialDraft)
  const [categoryId, setCategoryId] = useState(initialDraft?.categoryId ?? '')
  const [subcategoryId, setSubcategoryId] = useState<string | null>(initialDraft?.subcategoryId ?? null)
  const [operationTypeId, setOperationTypeId] = useState<string | null>(initialDraft?.operationTypeId ?? null)
  const [first, setFirst] = useState(initialDraft?.first ?? ''); const [last, setLast] = useState(initialDraft?.last ?? '')
  const [phone, setPhone] = useState(initialDraft?.phone ?? '')
  const [age, setAge] = useState(initialDraft?.age ?? ''); const [weightKg, setWeightKg] = useState(initialDraft?.weightKg ?? ''); const [heightCm, setHeightCm] = useState(initialDraft?.heightCm ?? '')
  const [gender, setGender] = useState<Gender | ''>(initialDraft?.gender ?? '')
  const [pastSurgeries, setPastSurgeries] = useState<MedicalField>(initialDraft?.pastSurgeries ?? emptyMedical)
  const [knownConditions, setKnownConditions] = useState<MedicalField>(initialDraft?.knownConditions ?? emptyMedical)
  const [medications, setMedications] = useState<MedicalField>(initialDraft?.medications ?? emptyMedical)
  const [notes, setNotes] = useState(initialDraft?.notes ?? ''); const [files, setFiles] = useState<File[]>(initialDraft?.files ?? [])
  const [xrayFiles, setXrayFiles] = useState<File[]>(initialDraft?.xrayFiles ?? [])
  const [warn, setWarn] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [selectedPatient, setSelectedPatient] = useState<MatchRow | null>(null)
  const subs = useSubcategories(categoryId)
  const ops = useOperationTypes(categoryId, subcategoryId)
  const create = useCreateRequest()

  const draftRef = useRef<RequestDraft>({
    first, last, phone, age, weightKg, heightCm, gender,
    pastSurgeries, knownConditions, medications,
    categoryId, subcategoryId, operationTypeId,
    notes, files, xrayFiles,
  })
  draftRef.current = {
    first, last, phone, age, weightKg, heightCm, gender,
    pastSurgeries, knownConditions, medications,
    categoryId, subcategoryId, operationTypeId,
    notes, files, xrayFiles,
  }
  const submittedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (!submittedRef.current && !isDraftEmpty(draftRef.current)) {
        saveDraft(draftRef.current)
      }
    }
  }, [])

  // M5: mükerrer hasta eşleştirme — telefon + ad + soyad girilince debounce'lu RPC.
  // Zaten "aynı hasta" seçilmişse yeni arama yapılmaz (kullanıcı kararını bozmamak için).
  useEffect(() => {
    if (selectedPatient) { setMatches([]); return }
    if (normalizePhone(phone).length < 7 || !first.trim() || !last.trim()) { setMatches([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      supabase.rpc('find_patient_matches', { p_phone: phone, p_first: first, p_last: last })
        .then(({ data, error }) => {
          if (cancelled || error) return
          setMatches((data ?? []) as MatchRow[])
        })
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [phone, first, last, selectedPatient])

  const clearDraftAndReset = () => {
    clearDraft()
    setDraftRestored(false)
    setCategoryId(''); setSubcategoryId(null); setOperationTypeId(null)
    setFirst(''); setLast(''); setPhone('')
    setAge(''); setWeightKg(''); setHeightCm('')
    setGender('')
    setPastSurgeries(emptyMedical); setKnownConditions(emptyMedical); setMedications(emptyMedical)
    setNotes(''); setFiles([]); setXrayFiles([])
    setMatches([]); setSelectedPatient(null)
  }

  const selectedCat = cats.data?.find((c) => c.id === categoryId)
  const needsSub = selectedCat?.has_subcategories
  const isDental = selectedCat?.name === 'Diş Tedavisi'

  const ageNum = Number(age); const weightNum = Number(weightKg); const heightNum = Number(heightCm)
  const medicalValid = (m: MedicalField) => m.none || !!m.text.trim()

  // Üç alan da doluyken aralık doğrulaması yap (yazarken erken uyarı vermemek için)
  const demoError = age && weightKg && heightCm ? demographicsError(ageNum, weightNum, heightNum) : null

  const phoneOk = normalizePhone(phone).length >= 10
  const ageOk = ageNum > 0 && !demoError
  const weightOk = weightNum > 0 && !demoError
  const heightOk = heightNum > 0 && !demoError
  const medicalOk = medicalValid(pastSurgeries) && medicalValid(knownConditions) && medicalValid(medications)

  const canSubmit = !!first && !!last && phoneOk && ageOk && weightOk && heightOk && !!gender &&
    !!categoryId && (!needsSub || !!subcategoryId) &&
    medicalOk && files.length > 0

  const missing = missingFields({
    first, last, phoneOk, ageOk, weightOk, heightOk, gender,
    categoryId, needsSub: !!needsSub, subcategoryId,
    medicalOk, filesCount: files.length,
  })

  // M5 FR-44: seçilen adayda önceki fotoğraflar silinmişse yeni talebe güncel foto zorunluluğu.
  const photosRequired = !!selectedPatient && selectedPatient.had_deleted_photos && !selectedPatient.has_available_photos

  const [submitErr, setSubmitErr] = useState<string | null>(null)

  const submit = async () => {
    try {
      const res = await create.mutateAsync({
        tenantId: appUser!.tenant_id, createdBy: appUser!.id,
        patient: { first_name: first, last_name: last, phone: normalizePhone(phone) },
        existingPatientId: selectedPatient?.patient_id,
        photosRequired,
        // DB kolonları integer: gönderimde yuvarla (ör. 172.5 -> 173)
        age: Math.round(ageNum), weightKg: weightNum, heightCm: Math.round(heightNum), gender: gender as Gender,
        pastSurgeries: medicalValue(pastSurgeries.none, pastSurgeries.text) ?? '',
        knownConditions: medicalValue(knownConditions.none, knownConditions.text) ?? '',
        medications: medicalValue(medications.none, medications.text) ?? '',
        categoryId, subcategoryId: needsSub ? subcategoryId : null,
        operationTypeId, notes, files,
        xrayFiles: isDental ? xrayFiles : undefined,
      })
      setSubmitErr(null)
      submittedRef.current = true
      clearDraft()
      if (res.assignedCount === 0) {
        setWarn('Talep kaydedildi ancak bu kategoride uygun aktif doktor bulunamadı; koordinatör atama yapacaktır.')
        return
      }
      nav('/requests')
    } catch (e) {
      setSubmitErr('Talep gönderilemedi: ' + (e as Error).message)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Yeni Talep" />
      {draftRestored && (
        <div className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
          <span>Kaydedilmemiş taslak geri yüklendi.</span>
          <Button variant="ghost" onClick={clearDraftAndReset}>Taslağı temizle</Button>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-4">
        <Card title="Hasta Bilgileri">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Ad">
                <input className={inputClass} placeholder="Ad" value={first} onChange={(e) => setFirst(e.target.value)} />
              </Field>
              <Field label="Soyad">
                <input className={inputClass} placeholder="Soyad" value={last} onChange={(e) => setLast(e.target.value)} />
              </Field>
              <Field label="Telefon">
                <input className={inputClass} type="tel" placeholder="05XX XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Field label="Yaş">
                <input className={inputClass} type="number" placeholder="Yaş" value={age} onChange={(e) => setAge(e.target.value)} />
              </Field>
              <Field label="Cinsiyet">
                <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                  <option value="">Cinsiyet seç…</option>
                  <option value="female">Kadın</option>
                  <option value="male">Erkek</option>
                  <option value="other">Diğer</option>
                </select>
              </Field>
              <Field label="Boy">
                <input className={inputClass} type="number" placeholder="Boy (cm)" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              </Field>
              <Field label="Kilo">
                <input className={inputClass} type="number" placeholder="Kilo (kg)" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>

        {!selectedPatient && matches.length > 0 && (
          <DuplicateMatchPanel
            matches={matches}
            onSelectSame={(m) => { setSelectedPatient(m); setMatches([]) }}
            onDismiss={() => setMatches([])}
          />
        )}

        {selectedPatient && (
          <Card className="border border-brand-100 bg-brand-50">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-brand-700">
                  Mevcut hastaya bağlanıyor: <span className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</span>
                </p>
                <button
                  type="button"
                  aria-label="Seçimi geri al"
                  className="text-slate-400 hover:text-slate-600"
                  onClick={() => setSelectedPatient(null)}
                >
                  ×
                </button>
              </div>
              {selectedPatient.had_deleted_photos && !selectedPatient.has_available_photos && (
                <p className="text-sm text-amber-700">
                  Fotoğraf yeniden gerekli: önceki fotoğraflar KVKK gereği silinmiş, güncel fotoğraf ekleyin.
                </p>
              )}
              {selectedPatient.has_open_request && (
                <p className="text-sm text-slate-600">
                  Bu hastanın doktor yanıtı bekleyen başka talebi var.
                </p>
              )}
            </div>
          </Card>
        )}

        <Card title="Operasyon">
          <div className="space-y-3">
            <Field label="Kategori">
              <select className={inputClass} value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(null); setOperationTypeId(null) }}>
                <option value="">Kategori seç…</option>
                {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            {needsSub && (
              <Field label="Alt kırılım">
                <select className={inputClass} value={subcategoryId ?? ''}
                  onChange={(e) => setSubcategoryId(e.target.value || null)}>
                  <option value="">Alt kırılım seç… (zorunlu)</option>
                  {subs.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}
            {categoryId && (
              <Field label="Operasyon tipi">
                <select className={inputClass} value={operationTypeId ?? ''}
                  onChange={(e) => setOperationTypeId(e.target.value || null)}>
                  <option value="">Operasyon tipi (opsiyonel)…</option>
                  {ops.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
            )}
          </div>
        </Card>

        <Card title="Tıbbi Geçmiş">
          <div className="space-y-4">
            {/* Field kullanılmıyor: dış <label> içindeki iç <label> geçersiz HTML olur
                ve başlığa tıklamak "Yok" checkbox'ını yanlışlıkla toggle'lar. */}
            <div className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">Geçmiş ameliyatlar</span>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label="Yok" checked={pastSurgeries.none}
                  onChange={(e) => setPastSurgeries({ ...pastSurgeries, none: e.target.checked })} />
                Yok
              </label>
              {!pastSurgeries.none && (
                <textarea className={inputClass} placeholder="Geçmiş ameliyatlar"
                  value={pastSurgeries.text} onChange={(e) => setPastSurgeries({ ...pastSurgeries, text: e.target.value })} />
              )}
            </div>

            <div className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">Bilinen hastalıklar</span>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label="Yok" checked={knownConditions.none}
                  onChange={(e) => setKnownConditions({ ...knownConditions, none: e.target.checked })} />
                Yok
              </label>
              {!knownConditions.none && (
                <textarea className={inputClass} placeholder="Bilinen hastalıklar"
                  value={knownConditions.text} onChange={(e) => setKnownConditions({ ...knownConditions, text: e.target.value })} />
              )}
            </div>

            <div className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">Düzenli kullanılan ilaçlar</span>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label="Yok" checked={medications.none}
                  onChange={(e) => setMedications({ ...medications, none: e.target.checked })} />
                Yok
              </label>
              {!medications.none && (
                <textarea className={inputClass} placeholder="Düzenli kullanılan ilaçlar"
                  value={medications.text} onChange={(e) => setMedications({ ...medications, text: e.target.value })} />
              )}
            </div>
          </div>
        </Card>

        <Card title="Fotoğraflar">
          <PhotoUploader files={files} onChange={setFiles} />
          {files.length > 0 && (
            <p className="text-sm text-slate-500">{files.map((f) => f.name).join(', ')}</p>
          )}
        </Card>

        {isDental && (
          <Card title="Diş Röntgeni">
            <PhotoUploader files={xrayFiles} onChange={setXrayFiles} />
            {xrayFiles.length > 0 && (
              <p className="text-sm text-slate-500">{xrayFiles.map((f) => f.name).join(', ')}</p>
            )}
          </Card>
        )}

        <Card title="Not">
          <textarea className={inputClass} placeholder="Not" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Card>

        {(demoError || submitErr || warn) && (
          <div className="space-y-1">
            {demoError && <p className="text-red-600 text-sm">{demoError}</p>}
            {submitErr && <p className="text-red-600 text-sm">{submitErr}</p>}
            {warn && <p className="text-amber-700 text-sm">{warn}</p>}
          </div>
        )}

        <div className="sticky bottom-0">
          <Card className="flex items-center justify-between gap-4">
            {!canSubmit && missing.length > 0 ? (
              <p className="text-sm text-slate-500">Eksik: {missing.join(', ')}</p>
            ) : <span />}
            <Button variant="primary" loading={create.isPending} disabled={!canSubmit || create.isPending} onClick={submit}>
              Gönder
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
