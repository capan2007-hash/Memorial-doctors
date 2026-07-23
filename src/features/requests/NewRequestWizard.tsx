import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Info, User, X } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useCategories, useSubcategories, useOperationTypes } from '../catalog/useCatalog'
import { useCreateRequest } from './useRequests'
import { PhotoUploader } from '../../components/PhotoUploader'
import { medicalValue, demographicsError } from '../../domain/health'
import { packYears, lifestyleComplete, type SmokingStatus, type AlcoholStatus } from '../../domain/lifestyle'
import { normalizePhone } from '../../domain/phone'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { saveDraft, loadDraft, clearDraft, isDraftEmpty, type RequestDraft } from './requestDraft'
import { missingFields } from './missingFields'
import { DuplicateMatchPanel, type MatchRow } from './DuplicateMatchPanel'

type Gender = 'female' | 'male' | 'other'

interface MedicalField {
  none: boolean
  text: string
}

const emptyMedical: MedicalField = { none: false, text: '' }
const NONE = '__none__'

/** Etiketli shadcn Select — native <select>'lerin premium karşılığı. */
function LabeledSelect({
  label,
  value,
  onChange,
  placeholder,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

/** Tıbbi geçmiş bloğu: "Yok" onay kutusu + koşullu metin alanı. */
function MedicalBlock({
  label,
  value,
  onChange,
  id,
}: {
  label: string
  value: MedicalField
  onChange: (v: MedicalField) => void
  id: string
}) {
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox id={id} checked={value.none} onCheckedChange={(c) => onChange({ ...value, none: c === true })} />
        Yok
      </label>
      {!value.none && (
        <Textarea placeholder={label} value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} />
      )}
    </div>
  )
}

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
  const [smokingStatus, setSmokingStatus] = useState(initialDraft?.smokingStatus ?? '')
  const [smokingCigs, setSmokingCigs] = useState(initialDraft?.smokingCigs ?? '')
  const [smokingYears, setSmokingYears] = useState(initialDraft?.smokingYears ?? '')
  const [alcoholStatus, setAlcoholStatus] = useState(initialDraft?.alcoholStatus ?? '')
  const [alcoholDrinks, setAlcoholDrinks] = useState(initialDraft?.alcoholDrinks ?? '')
  const [notes, setNotes] = useState(initialDraft?.notes ?? ''); const [files, setFiles] = useState<File[]>(initialDraft?.files ?? [])
  const [xrayFiles, setXrayFiles] = useState<File[]>(initialDraft?.xrayFiles ?? [])
  const [consentGiven, setConsentGiven] = useState(false)
  const [warn, setWarn] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [selectedPatient, setSelectedPatient] = useState<MatchRow | null>(null)
  const subs = useSubcategories(categoryId)
  const ops = useOperationTypes(categoryId, subcategoryId)
  const create = useCreateRequest()

  const draftRef = useRef<RequestDraft>({
    first, last, phone, age, weightKg, heightCm, gender,
    pastSurgeries, knownConditions, medications,
    smokingStatus, smokingCigs, smokingYears, alcoholStatus, alcoholDrinks,
    categoryId, subcategoryId, operationTypeId,
    notes, files, xrayFiles,
  })
  draftRef.current = {
    first, last, phone, age, weightKg, heightCm, gender,
    pastSurgeries, knownConditions, medications,
    smokingStatus, smokingCigs, smokingYears, alcoholStatus, alcoholDrinks,
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
    setSmokingStatus(''); setSmokingCigs(''); setSmokingYears(''); setAlcoholStatus(''); setAlcoholDrinks('')
    setNotes(''); setFiles([]); setXrayFiles([])
    setConsentGiven(false)
    setMatches([]); setSelectedPatient(null)
  }

  const selectedCat = cats.data?.find((c) => c.id === categoryId)
  const needsSub = selectedCat?.has_subcategories
  const isDental = selectedCat?.name === 'Diş Tedavisi'

  const ageNum = Number(age); const weightNum = Number(weightKg); const heightNum = Number(heightCm)
  const medicalValid = (m: MedicalField) => m.none || !!m.text.trim()

  const demoError = age && weightKg && heightCm ? demographicsError(ageNum, weightNum, heightNum) : null

  const phoneOk = normalizePhone(phone).length >= 10
  const ageOk = ageNum > 0 && !demoError
  const weightOk = weightNum > 0 && !demoError
  const heightOk = heightNum > 0 && !demoError
  const medicalOk = medicalValid(pastSurgeries) && medicalValid(knownConditions) && medicalValid(medications)
  const lifestyleOk = lifestyleComplete({ smokingStatus, smokingCigs, smokingYears, alcoholStatus, alcoholDrinks })

  const canSubmit = !!first && !!last && phoneOk && ageOk && weightOk && heightOk && !!gender &&
    !!categoryId && (!needsSub || !!subcategoryId) &&
    medicalOk && lifestyleOk && files.length > 0

  const missing = missingFields({
    first, last, phoneOk, ageOk, weightOk, heightOk, gender,
    categoryId, needsSub: !!needsSub, subcategoryId,
    medicalOk, lifestyleOk, filesCount: files.length,
  })

  const photosRequired = !!selectedPatient && selectedPatient.had_deleted_photos && !selectedPatient.has_available_photos

  const [submitErr, setSubmitErr] = useState<string | null>(null)

  const submit = async () => {
    try {
      const res = await create.mutateAsync({
        tenantId: appUser!.tenant_id, createdBy: appUser!.id,
        patient: { first_name: first, last_name: last, phone: normalizePhone(phone) },
        existingPatientId: selectedPatient?.patient_id,
        photosRequired,
        age: Math.round(ageNum), weightKg: weightNum, heightCm: Math.round(heightNum), gender: gender as Gender,
        pastSurgeries: medicalValue(pastSurgeries.none, pastSurgeries.text) ?? '',
        knownConditions: medicalValue(knownConditions.none, knownConditions.text) ?? '',
        medications: medicalValue(medications.none, medications.text) ?? '',
        smokingStatus: (smokingStatus || null) as SmokingStatus | null,
        smokingCigsPerDay: smokingStatus === 'current' || smokingStatus === 'former' ? Number(smokingCigs) : null,
        smokingYears: smokingStatus === 'current' || smokingStatus === 'former' ? Number(smokingYears) : null,
        alcoholStatus: (alcoholStatus || null) as AlcoholStatus | null,
        alcoholDrinksPerWeek: alcoholStatus === 'regular' ? Number(alcoholDrinks) : null,
        categoryId, subcategoryId: needsSub ? subcategoryId : null,
        operationTypeId, notes, files,
        xrayFiles: isDental ? xrayFiles : undefined,
        consentGiven,
      })
      setSubmitErr(null)
      submittedRef.current = true
      clearDraft()
      if (res.routed === 'coordinator') {
        setWarn('Bu hastanın aktif bir talebi var — kayıt koordinatör onayına gönderildi.')
        return
      }
      if (res.assignedCount === 0) {
        setWarn('Talep kaydedildi ancak bu kategoride uygun aktif doktor bulunamadı; koordinatör atama yapacaktır.')
        return
      }
      nav('/requests')
    } catch (e) {
      setSubmitErr('Talep gönderilemedi: ' + (e as Error).message)
    }
  }

  const packYearsVal = packYears(Number(smokingCigs), Number(smokingYears))

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28">
      {/* Premium başlık */}
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-fill/10 text-brand-text">
          <User className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Yeni Talep</h1>
          <p className="text-sm text-muted-foreground">Hasta bilgilerini girin; sistem uygun doktorlara otomatik yönlendirir.</p>
        </div>
      </div>

      {draftRestored && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2 text-sm text-info-text">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" strokeWidth={1.75} />
            Kaydedilmemiş taslak geri yüklendi.
          </span>
          <Button variant="ghost" onClick={clearDraftAndReset}>
            Taslağı temizle
          </Button>
        </div>
      )}

      <Card title="Hasta Bilgileri">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Ad">
              <Input placeholder="Ad" value={first} onChange={(e) => setFirst(e.target.value)} />
            </Field>
            <Field label="Soyad">
              <Input placeholder="Soyad" value={last} onChange={(e) => setLast(e.target.value)} />
            </Field>
            <Field label="Telefon">
              <Input type="tel" placeholder="05XX XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Yaş">
              <Input type="number" placeholder="Yaş" value={age} onChange={(e) => setAge(e.target.value)} />
            </Field>
            <LabeledSelect label="Cinsiyet" value={gender} onChange={(v) => setGender(v as Gender)} placeholder="Seçin">
              <SelectItem value="female">Kadın</SelectItem>
              <SelectItem value="male">Erkek</SelectItem>
              <SelectItem value="other">Diğer</SelectItem>
            </LabeledSelect>
            <Field label="Boy (cm)">
              <Input type="number" placeholder="Boy" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </Field>
            <Field label="Kilo (kg)">
              <Input type="number" placeholder="Kilo" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
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
        <div className="space-y-2 rounded-lg border border-brand-fill/30 bg-brand-fill/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-brand-text">
              Mevcut hastaya bağlanıyor:{' '}
              <span className="font-semibold">{selectedPatient.first_name} {selectedPatient.last_name}</span>
            </p>
            <button
              type="button"
              aria-label="Seçimi geri al"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setSelectedPatient(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {selectedPatient.had_deleted_photos && !selectedPatient.has_available_photos && (
            <p className="flex items-center gap-1.5 text-sm text-warning-text">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              Fotoğraf yeniden gerekli: önceki fotoğraflar KVKK gereği silinmiş, güncel fotoğraf ekleyin.
            </p>
          )}
          {selectedPatient.has_open_request && (
            <p className="text-sm text-muted-foreground">Bu hastanın doktor yanıtı bekleyen başka talebi var.</p>
          )}
        </div>
      )}

      <Card title="Operasyon">
        <div className="space-y-4">
          <LabeledSelect
            label="Kategori"
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setSubcategoryId(null); setOperationTypeId(null) }}
            placeholder="Kategori seçin"
          >
            {cats.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </LabeledSelect>
          {needsSub && (
            <LabeledSelect
              label="Alt kırılım"
              value={subcategoryId ?? ''}
              onChange={(v) => setSubcategoryId(v || null)}
              placeholder="Alt kırılım seçin (zorunlu)"
            >
              {subs.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </LabeledSelect>
          )}
          {categoryId && (
            <LabeledSelect
              label="Operasyon tipi (opsiyonel)"
              value={operationTypeId ?? NONE}
              onChange={(v) => setOperationTypeId(v === NONE ? null : v)}
              placeholder="Operasyon tipi seçin"
            >
              <SelectItem value={NONE}>Seçilmedi</SelectItem>
              {ops.data?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </LabeledSelect>
          )}
        </div>
      </Card>

      <Card title="Tıbbi Geçmiş">
        <div className="space-y-5">
          <MedicalBlock id="past" label="Geçmiş ameliyatlar" value={pastSurgeries} onChange={setPastSurgeries} />
          <MedicalBlock id="cond" label="Bilinen hastalıklar" value={knownConditions} onChange={setKnownConditions} />
          <MedicalBlock id="meds" label="Düzenli kullanılan ilaçlar" value={medications} onChange={setMedications} />
        </div>
      </Card>

      <Card title="Sigara & Alkol">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <LabeledSelect label="Sigara" value={smokingStatus} onChange={setSmokingStatus} placeholder="Seçin">
              <SelectItem value="never">Hiç kullanmadı</SelectItem>
              <SelectItem value="former">Bıraktı</SelectItem>
              <SelectItem value="current">Aktif içici</SelectItem>
            </LabeledSelect>
            {(smokingStatus === 'current' || smokingStatus === 'former') && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Günlük adet">
                    <Input type="number" min={0} max={200} placeholder="ör. 20" value={smokingCigs} onChange={(e) => setSmokingCigs(e.target.value)} />
                  </Field>
                  <Field label="Kaç yıldır">
                    <Input type="number" min={0} max={100} placeholder="ör. 10" value={smokingYears} onChange={(e) => setSmokingYears(e.target.value)} />
                  </Field>
                </div>
                {packYearsVal != null && (
                  <p className="text-sm text-muted-foreground">
                    ≈ <span className="tnum font-semibold text-foreground">{packYearsVal}</span> paket-yıl
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <LabeledSelect label="Alkol" value={alcoholStatus} onChange={setAlcoholStatus} placeholder="Seçin">
              <SelectItem value="never">Hiç</SelectItem>
              <SelectItem value="occasional">Sosyal (ara sıra)</SelectItem>
              <SelectItem value="regular">Düzenli</SelectItem>
            </LabeledSelect>
            {alcoholStatus === 'regular' && (
              <Field label="Haftalık standart içki">
                <Input type="number" min={0} max={200} placeholder="ör. 14" value={alcoholDrinks} onChange={(e) => setAlcoholDrinks(e.target.value)} />
              </Field>
            )}
          </div>
        </div>
      </Card>

      <Card title="Fotoğraflar">
        <PhotoUploader files={files} onChange={setFiles} />
        {files.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{files.map((f) => f.name).join(', ')}</p>}
      </Card>

      {isDental && (
        <Card title="Diş Röntgeni">
          <PhotoUploader files={xrayFiles} onChange={setXrayFiles} />
          {xrayFiles.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{xrayFiles.map((f) => f.name).join(', ')}</p>}
        </Card>
      )}

      <Card title="Not">
        <Textarea placeholder="Ek not (opsiyonel)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>

      <Card title="Onam">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
          <Checkbox className="mt-0.5" checked={consentGiven} onCheckedChange={(c) => setConsentGiven(c === true)} />
          <span>
            Hastadan aydınlatma metni paylaşıldı ve yurt dışı aktarım dahil açık rıza alındı (WhatsApp).{' '}
            <a href="/aydinlatma" target="_blank" rel="noopener" className="font-medium text-brand-text underline underline-offset-2 hover:text-brand-fill">
              Aydınlatma metnini görüntüle
            </a>
          </span>
        </label>
        <p className="mt-2 text-sm text-muted-foreground">İşaretlenmezse yapay zekâ ön değerlendirmesi yapılmaz.</p>
      </Card>

      {(demoError || submitErr || warn) && (
        <div className="space-y-1">
          {demoError && <p className="text-sm text-destructive">{demoError}</p>}
          {submitErr && <p className="text-sm text-destructive">{submitErr}</p>}
          {warn && <p className="text-sm text-warning-text">{warn}</p>}
        </div>
      )}

      {/* Yapışkan gönder çubuğu */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {!canSubmit && missing.length > 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning-text" strokeWidth={1.75} />
              <span className="line-clamp-1">Eksik: {missing.join(', ')}</span>
            </p>
          ) : (
            <span className="text-sm text-muted-foreground">Tüm zorunlu alanlar tamam.</span>
          )}
          <Button variant="primary" loading={create.isPending} disabled={!canSubmit || create.isPending} onClick={submit} className="shrink-0">
            Gönder
          </Button>
        </div>
      </div>
    </div>
  )
}
