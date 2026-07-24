import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('requests')
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox id={id} checked={value.none} onCheckedChange={(c) => onChange({ ...value, none: c === true })} />
        {t('newRequest.none')}
      </label>
      {!value.none && (
        <Textarea placeholder={label} value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} />
      )}
    </div>
  )
}

export function NewRequestWizard() {
  const { t } = useTranslation('requests')
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
        setWarn(t('newRequest.routedToCoordinator'))
        return
      }
      if (res.assignedCount === 0) {
        setWarn(t('newRequest.noDoctorAssigned'))
        return
      }
      nav('/requests')
    } catch (e) {
      setSubmitErr(t('newRequest.submitFailed', { message: (e as Error).message }))
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
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t('newRequest.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('newRequest.subtitle')}</p>
        </div>
      </div>

      {draftRestored && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2 text-sm text-info-text">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" strokeWidth={1.75} />
            {t('newRequest.draftRestored')}
          </span>
          <Button variant="ghost" onClick={clearDraftAndReset}>
            {t('newRequest.clearDraft')}
          </Button>
        </div>
      )}

      <Card title={t('patientInfo.title')}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={t('newRequest.firstNameLabel')}>
              <Input placeholder={t('newRequest.firstNameLabel')} value={first} onChange={(e) => setFirst(e.target.value)} />
            </Field>
            <Field label={t('newRequest.lastNameLabel')}>
              <Input placeholder={t('newRequest.lastNameLabel')} value={last} onChange={(e) => setLast(e.target.value)} />
            </Field>
            <Field label={t('newRequest.phoneLabel')}>
              <Input type="tel" placeholder={t('newRequest.phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label={t('newRequest.ageLabel')}>
              <Input type="number" placeholder={t('newRequest.ageLabel')} value={age} onChange={(e) => setAge(e.target.value)} />
            </Field>
            <LabeledSelect label={t('newRequest.genderLabel')} value={gender} onChange={(v) => setGender(v as Gender)} placeholder={t('newRequest.selectPlaceholder')}>
              <SelectItem value="female">Kadın</SelectItem>
              <SelectItem value="male">Erkek</SelectItem>
              <SelectItem value="other">Diğer</SelectItem>
            </LabeledSelect>
            <Field label={t('newRequest.heightLabel')}>
              <Input type="number" placeholder={t('newRequest.heightPlaceholder')} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </Field>
            <Field label={t('newRequest.weightLabel')}>
              <Input type="number" placeholder={t('newRequest.weightPlaceholder')} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
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
              {t('newRequest.linkingToExisting')}{' '}
              <span className="font-semibold">{selectedPatient.first_name} {selectedPatient.last_name}</span>
            </p>
            <button
              type="button"
              aria-label={t('newRequest.undoSelectionAria')}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setSelectedPatient(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {selectedPatient.had_deleted_photos && !selectedPatient.has_available_photos && (
            <p className="flex items-center gap-1.5 text-sm text-warning-text">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              {t('newRequest.photosRequiredAgain')}
            </p>
          )}
          {selectedPatient.has_open_request && (
            <p className="text-sm text-muted-foreground">{t('newRequest.hasOpenRequestNote')}</p>
          )}
        </div>
      )}

      <Card title={t('newRequest.operationSectionTitle')}>
        <div className="space-y-4">
          <LabeledSelect
            label={t('newRequest.categoryLabel')}
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setSubcategoryId(null); setOperationTypeId(null) }}
            placeholder={t('newRequest.categoryPlaceholder')}
          >
            {cats.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </LabeledSelect>
          {needsSub && (
            <LabeledSelect
              label={t('newRequest.subcategoryLabel')}
              value={subcategoryId ?? ''}
              onChange={(v) => setSubcategoryId(v || null)}
              placeholder={t('newRequest.subcategoryPlaceholder')}
            >
              {subs.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </LabeledSelect>
          )}
          {categoryId && (
            <LabeledSelect
              label={t('newRequest.operationTypeLabel')}
              value={operationTypeId ?? NONE}
              onChange={(v) => setOperationTypeId(v === NONE ? null : v)}
              placeholder={t('newRequest.operationTypePlaceholder')}
            >
              <SelectItem value={NONE}>{t('newRequest.operationTypeNone')}</SelectItem>
              {ops.data?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </LabeledSelect>
          )}
        </div>
      </Card>

      <Card title={t('newRequest.medicalHistoryTitle')}>
        <div className="space-y-5">
          <MedicalBlock id="past" label={t('newRequest.pastSurgeriesLabel')} value={pastSurgeries} onChange={setPastSurgeries} />
          <MedicalBlock id="cond" label={t('newRequest.knownConditionsLabel')} value={knownConditions} onChange={setKnownConditions} />
          <MedicalBlock id="meds" label={t('newRequest.medicationsLabel')} value={medications} onChange={setMedications} />
        </div>
      </Card>

      <Card title={t('newRequest.smokingAlcoholTitle')}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <LabeledSelect label={t('newRequest.smokingLabel')} value={smokingStatus} onChange={setSmokingStatus} placeholder={t('newRequest.selectPlaceholder')}>
              <SelectItem value="never">{t('newRequest.smoking.never')}</SelectItem>
              <SelectItem value="former">{t('newRequest.smoking.former')}</SelectItem>
              <SelectItem value="current">{t('newRequest.smoking.current')}</SelectItem>
            </LabeledSelect>
            {(smokingStatus === 'current' || smokingStatus === 'former') && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('newRequest.cigsPerDayLabel')}>
                    <Input type="number" min={0} max={200} placeholder={t('newRequest.cigsPerDayPlaceholder')} value={smokingCigs} onChange={(e) => setSmokingCigs(e.target.value)} />
                  </Field>
                  <Field label={t('newRequest.smokingYearsLabel')}>
                    <Input type="number" min={0} max={100} placeholder={t('newRequest.smokingYearsPlaceholder')} value={smokingYears} onChange={(e) => setSmokingYears(e.target.value)} />
                  </Field>
                </div>
                {packYearsVal != null && (
                  <p className="text-sm text-muted-foreground">
                    ≈ <span className="tnum font-semibold text-foreground">{packYearsVal}</span> {t('newRequest.packYearsUnit')}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <LabeledSelect label={t('newRequest.alcoholLabel')} value={alcoholStatus} onChange={setAlcoholStatus} placeholder={t('newRequest.selectPlaceholder')}>
              <SelectItem value="never">{t('newRequest.alcohol.never')}</SelectItem>
              <SelectItem value="occasional">{t('newRequest.alcohol.occasional')}</SelectItem>
              <SelectItem value="regular">{t('newRequest.alcohol.regular')}</SelectItem>
            </LabeledSelect>
            {alcoholStatus === 'regular' && (
              <Field label={t('newRequest.weeklyDrinksLabel')}>
                <Input type="number" min={0} max={200} placeholder={t('newRequest.weeklyDrinksPlaceholder')} value={alcoholDrinks} onChange={(e) => setAlcoholDrinks(e.target.value)} />
              </Field>
            )}
          </div>
        </div>
      </Card>

      <Card title={t('newRequest.photosTitle')}>
        <PhotoUploader files={files} onChange={setFiles} />
        {files.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{files.map((f) => f.name).join(', ')}</p>}
      </Card>

      {isDental && (
        <Card title={t('newRequest.xraysTitle')}>
          <PhotoUploader files={xrayFiles} onChange={setXrayFiles} />
          {xrayFiles.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{xrayFiles.map((f) => f.name).join(', ')}</p>}
        </Card>
      )}

      <Card title={t('newRequest.notesTitle')}>
        <Textarea placeholder={t('newRequest.notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>

      <Card title={t('newRequest.consentTitle')}>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
          <Checkbox className="mt-0.5" checked={consentGiven} onCheckedChange={(c) => setConsentGiven(c === true)} />
          <span>
            {t('newRequest.consentText')}{' '}
            <a href="/aydinlatma" target="_blank" rel="noopener" className="font-medium text-brand-text underline underline-offset-2 hover:text-brand-fill">
              {t('newRequest.consentLinkText')}
            </a>
          </span>
        </label>
        <p className="mt-2 text-sm text-muted-foreground">{t('newRequest.consentHint')}</p>
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
              <span className="line-clamp-1">
                {t('newRequest.missingSummary', { list: missing.map((k) => t(`newRequest.missingLabels.${k}`)).join(', ') })}
              </span>
            </p>
          ) : (
            <span className="text-sm text-muted-foreground">{t('newRequest.allFieldsComplete')}</span>
          )}
          <Button variant="primary" loading={create.isPending} disabled={!canSubmit || create.isPending} onClick={submit} className="shrink-0">
            {t('newRequest.submit')}
          </Button>
        </div>
      </div>
    </div>
  )
}
