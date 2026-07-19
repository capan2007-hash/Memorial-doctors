import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useCategories, useSubcategories } from '../catalog/useCatalog'
import {
  useDoctorsFull, useDoctorMetrics, useUpdateDoctor, useCreateDoctor,
  uploadDoctorPhoto, signDoctorPhoto,
  emptyWeightedWork, toWeightedWork,
  useScoreEvents,
} from './useDoctors'
import type { DoctorScope, DoctorWithScopes, WeightedWork, WeightedWorkLevel } from './useDoctors'
import type { CategoryRow, SubcategoryRow } from '../../types/db'
import { netChangeInRange, monthlyNetChanges, scoreTier } from '../../domain/score'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { toDateInputValue, startOfDayIso, endOfDayIso } from '../../lib/format'
import { DoctorPerformanceDashboard } from './DoctorPerformanceDashboard'

const levelLabels: Record<WeightedWorkLevel, string> = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' }

const inputClass = 'w-full rounded-control border border-line bg-surface-1 text-ink-primary p-2 focus:outline-none focus:border-brand-fill focus:ring-2 focus:ring-brand-fill/20'

function scopeKey(s: DoctorScope) { return `${s.categoryId}::${s.subcategoryId ?? ''}` }

function hasScope(scopes: DoctorScope[], categoryId: string, subcategoryId: string | null) {
  return scopes.some((s) => s.categoryId === categoryId && s.subcategoryId === subcategoryId)
}

function toggleScope(scopes: DoctorScope[], entry: DoctorScope): DoctorScope[] {
  if (hasScope(scopes, entry.categoryId, entry.subcategoryId)) {
    return scopes.filter((s) => scopeKey(s) !== scopeKey(entry))
  }
  return [...scopes, entry]
}

/** Tek bir kategori satırı: alt kırılımı yoksa kategori checkbox'ı, varsa alt kırılım çoklu checkbox listesi. */
function CategoryScopeRow({ category, scopes, onChange }: {
  category: CategoryRow; scopes: DoctorScope[]; onChange: (next: DoctorScope[]) => void
}) {
  const subs = useSubcategories(category.has_subcategories ? category.id : undefined)
  if (!category.has_subcategories) {
    return (
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={hasScope(scopes, category.id, null)}
          onChange={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: null }))}
        />
        {category.name}
      </label>
    )
  }
  return (
    <div className="text-sm">
      <p className="font-medium text-ink-secondary">{category.name}</p>
      <div className="mt-1 ml-3 flex flex-wrap gap-3">
        {subs.data?.map((sc) => (
          <label key={sc.id} className="flex items-center gap-2 text-ink-secondary">
            <input
              type="checkbox"
              checked={hasScope(scopes, category.id, sc.id)}
              onChange={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: sc.id }))}
            />
            {sc.name}
          </label>
        ))}
        {!subs.data?.length && <span className="text-ink-muted">Alt kırılım yok</span>}
      </div>
    </div>
  )
}

function ScopeEditor({ scopes, onChange }: { scopes: DoctorScope[]; onChange: (next: DoctorScope[]) => void }) {
  const cats = useCategories()
  return (
    <div className="space-y-2 rounded-control border border-line p-3 bg-surface-1">
      {cats.data?.map((c) => (
        <CategoryScopeRow key={c.id} category={c} scopes={scopes} onChange={onChange} />
      ))}
    </div>
  )
}

function WeightedWorkEditor({ value, onChange }: { value: WeightedWork; onChange: (next: WeightedWork) => void }) {
  const updateItem = (idx: number, patch: Partial<{ area: string; level: WeightedWorkLevel }>) => {
    const items = value.items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    onChange({ ...value, items })
  }
  const removeItem = (idx: number) => onChange({ ...value, items: value.items.filter((_, i) => i !== idx) })
  const addItem = () => onChange({ ...value, items: [...value.items, { area: '', level: 'medium' }] })
  return (
    <div className="space-y-2 rounded-control border border-line p-3 bg-surface-1">
      {value.items.map((it, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            className={`${inputClass} flex-1 text-sm`} placeholder="Alan (ör. diz protezi)"
            value={it.area} onChange={(e) => updateItem(idx, { area: e.target.value })}
          />
          <select
            className={`${inputClass} w-auto text-sm`} value={it.level}
            onChange={(e) => updateItem(idx, { level: e.target.value as WeightedWorkLevel })}
          >
            {(['high', 'medium', 'low'] as WeightedWorkLevel[]).map((l) => (
              <option key={l} value={l}>{levelLabels[l]}</option>
            ))}
          </select>
          <Button variant="ghost" type="button" onClick={() => removeItem(idx)}>Sil</Button>
        </div>
      ))}
      <button type="button" className="text-sm text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40 rounded" onClick={addItem}>+ Satır ekle</button>
      <textarea
        className={`${inputClass} text-sm`} placeholder="Serbest not"
        value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })}
      />
    </div>
  )
}

/** Katalog kategori/alt kırılım adlarını yetkinlik çipleri için tenant kapsamında çözer (RLS zaten sınırlar). */
function useScopeLabels() {
  const cats = useCategories()
  const subs = useQuery({
    queryKey: ['all-subcategories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subcategory').select('*')
      if (error) throw error
      return data as SubcategoryRow[]
    },
  })
  return {
    categoryName: (id: string) => cats.data?.find((c) => c.id === id)?.name ?? '—',
    subcategoryName: (id: string) => subs.data?.find((s) => s.id === id)?.name ?? '—',
  }
}

function ScopeChips({ scopes }: { scopes: DoctorScope[] }) {
  const { categoryName, subcategoryName } = useScopeLabels()
  if (!scopes.length) return <p className="text-xs text-ink-muted">Yetkinlik atanmadı</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {scopes.map((s) => (
        <span key={scopeKey(s)} className="bg-brand-fill/10 text-brand-text border border-line text-xs px-2 py-1 rounded-full">
          {categoryName(s.categoryId)}{s.subcategoryId ? ` · ${subcategoryName(s.subcategoryId)}` : ''}
        </span>
      ))}
    </div>
  )
}

/** Depo yolundan imzalı URL çözüp Avatar'a besler; foto yoksa Avatar baş harfleri gösterir. */
function DoctorAvatar({ photoUrl, name, size }: { photoUrl: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const q = useQuery({
    queryKey: ['doctor-photo-signed', photoUrl],
    enabled: !!photoUrl,
    queryFn: () => signDoctorPhoto(photoUrl!),
  })
  return <Avatar src={photoUrl ? q.data : undefined} name={name} size={size} />
}

/** scoreTier zeminini (score.ts) yüzey-üstü semantik tinte eşler — eşik mantığı tekrarlanmaz. */
const TIER_TINT: Record<string, { bg: string; text: string }> = {
  'bg-rose-50': { bg: 'bg-danger-bg', text: 'text-danger-text' },
  'bg-amber-50': { bg: 'bg-warning-bg', text: 'text-warning-text' },
  'bg-brand-50': { bg: 'bg-success-bg', text: 'text-success-text' },
}

function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <Card className="text-center">
      <p className="font-display text-2xl tnum text-ink-primary">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </Card>
  )
}

function ScoreStatBox({ score }: { score: number }) {
  const tier = scoreTier(score)
  const tint = TIER_TINT[tier.bg] ?? { bg: 'bg-success-bg', text: 'text-success-text' }
  return (
    <Card className={`text-center ${tint.bg}`}>
      <p className={`font-display text-2xl tnum ${tint.text}`}>{score}</p>
      <p className="text-xs text-ink-muted">Skor</p>
      {tier.label && <p className={`text-[11px] font-semibold mt-0.5 ${tint.text}`}>{tier.label}</p>}
    </Card>
  )
}

function StatsGrid({ doctor }: { doctor: DoctorWithScopes }) {
  const metrics = useDoctorMetrics(doctor.id)
  const m = metrics.data
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <StatBox value={m?.acceptCount ?? 0} label="Kabul" />
      <StatBox value={m?.rejectCount ?? 0} label="Red" />
      <StatBox value={m && m.avgResponseMins != null ? Math.round(m.avgResponseMins) : '—'} label="Ort. dönüş (dk)" />
      <ScoreStatBox score={doctor.score} />
    </div>
  )
}

type ScorePreset = 'last30d' | 'custom'

/** FR-29b: zamanında/geç toplamları + dönemsel skor (preset "Son 1 ay" + serbest aralık) + son 6 ay mini liste.
 * Tek sorgu ile TÜM olaylar çekilir; aralık/aylık toplamlar istemci tarafında hesaplanır (grafik kütüphanesi yok). */
function ScoreSection({ doctorId }: { doctorId: string }) {
  const now = useMemo(() => new Date(), [])
  const [preset, setPreset] = useState<ScorePreset>('last30d')
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(new Date(now.getTime() - 30 * 86_400_000)))
  const [customTo, setCustomTo] = useState(() => toDateInputValue(now))

  const events = useScoreEvents(doctorId)
  const rows = events.data ?? []

  const totalTimely = rows.filter((e) => e.delta === 1).length
  const totalLate = rows.filter((e) => e.delta === -1).length

  const rangeFrom = preset === 'last30d' ? new Date(now.getTime() - 30 * 86_400_000).toISOString() : startOfDayIso(customFrom)
  const rangeTo = preset === 'last30d' ? now.toISOString() : endOfDayIso(customTo)
  const range = netChangeInRange(rows, rangeFrom, rangeTo)
  const monthly = monthlyNetChanges(rows, now, 6)

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-secondary">
        Zamanında: <span className="font-medium text-success-text tnum">{totalTimely}</span>
        {' · '}Geç: <span className="font-medium text-danger-text tnum">{totalLate}</span>
      </p>

      <div className="rounded-control border border-line p-3 bg-surface-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={preset === 'last30d' ? 'primary' : 'secondary'}
            onClick={() => setPreset('last30d')}
          >
            Son 1 ay
          </Button>
          <input
            type="date"
            className={`${inputClass} w-auto text-sm`}
            value={customFrom}
            onChange={(e) => { setCustomFrom(e.target.value); setPreset('custom') }}
          />
          <span className="text-ink-muted text-sm">–</span>
          <input
            type="date"
            className={`${inputClass} w-auto text-sm`}
            value={customTo}
            onChange={(e) => { setCustomTo(e.target.value); setPreset('custom') }}
          />
        </div>
        <p className="text-sm text-ink-secondary">
          Aralıktaki değişim: <span className="text-success-text font-medium tnum">+{range.positive}</span>
          {' '}<span className="text-danger-text font-medium tnum">−{range.negative}</span>
          {' = '}
          <span className="font-semibold tnum">net {range.net >= 0 ? `+${range.net}` : range.net}</span>
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-ink-muted mb-1">Son 6 ay</p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-secondary">
          {monthly.map((m) => (
            <li key={m.key}>
              {m.label}: <span className={`tnum ${m.net > 0 ? 'text-success-text' : m.net < 0 ? 'text-danger-text' : 'text-ink-muted'}`}>
                {m.net > 0 ? `+${m.net}` : m.net}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24" className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function SectionHeading({ children }: { children: string }) {
  return <h4 className="text-sm font-semibold text-ink-secondary pt-3 border-t border-line first:pt-0 first:border-t-0">{children}</h4>
}

function NewDoctorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appUser } = useAuth()
  const toast = useToast()
  const createDoctor = useCreateDoctor()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')
  const [scopes, setScopes] = useState<DoctorScope[]>([])
  const [weightedWork, setWeightedWork] = useState<WeightedWork>(emptyWeightedWork)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const canSubmit = !!email && !!password && !!fullName && scopes.length > 0 && !createDoctor.isPending

  const reset = () => {
    setEmail(''); setPassword(''); setFullName(''); setTitle(''); setSpecialty(''); setBio('')
    setScopes([]); setWeightedWork(emptyWeightedWork); setPhotoFile(null)
  }

  const submit = async () => {
    try {
      const result = await createDoctor.mutateAsync({ email, password, fullName, title, specialty, bio, weightedWork, scopes })
      const newDoctorId = result?.doctorId ?? result?.doctor?.id
      if (photoFile && newDoctorId && appUser?.tenant_id) {
        const path = await uploadDoctorPhoto(appUser.tenant_id, newDoctorId, photoFile)
        await supabase.from('doctor').update({ photo_url: path }).eq('id', newDoctorId)
      }
      reset()
      toast.show('Doktor oluşturuldu')
      onClose()
    } catch (e) {
      toast.show('Doktor oluşturulamadı: ' + (e as Error).message, 'error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="contents" onClick={(e) => e.stopPropagation()}>
        <Card
          title="Yeni Doktor Ekle"
          className="max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-3"
        >
          <SectionHeading>Hesap</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="E-posta">
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Geçici şifre">
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>

          <SectionHeading>Profil</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Ad Soyad">
              <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Unvan">
              <input className={inputClass} placeholder="ör. Op. Dr." value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Branş">
              <input className={inputClass} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            </Field>
          </div>
          <Field label="Biyografi">
            <textarea className={inputClass} placeholder="Biyografi / CV" value={bio} onChange={(e) => setBio(e.target.value)} />
          </Field>

          <SectionHeading>Yetkinlikler</SectionHeading>
          <ScopeEditor scopes={scopes} onChange={setScopes} />
          {!scopes.length && <p className="text-warning-text text-xs">En az bir yetkinlik (kategori/alt kırılım) seçilmeli.</p>}

          <SectionHeading>Ağırlıklı İşler</SectionHeading>
          <WeightedWorkEditor value={weightedWork} onChange={setWeightedWork} />

          <SectionHeading>Foto</SectionHeading>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="block text-sm" />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>Vazgeç</Button>
            <Button variant="primary" type="button" disabled={!canSubmit} loading={createDoctor.isPending} onClick={submit}>
              Oluştur
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function DoctorCard({ doctor }: { doctor: DoctorWithScopes }) {
  const { appUser } = useAuth()
  const toast = useToast()
  const updateDoctor = useUpdateDoctor()
  const [expanded, setExpanded] = useState(false)
  const [specialty, setSpecialty] = useState(doctor.specialty ?? '')
  const [bio, setBio] = useState(doctor.bio ?? '')
  const [isActive, setIsActive] = useState(doctor.is_active)
  const [scopes, setScopes] = useState<DoctorScope[]>(doctor.scopes)
  const [weightedWork, setWeightedWork] = useState<WeightedWork>(toWeightedWork(doctor.weighted_work))
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(doctor.photo_url)

  useEffect(() => {
    setSpecialty(doctor.specialty ?? ''); setBio(doctor.bio ?? ''); setIsActive(doctor.is_active)
    setScopes(doctor.scopes); setWeightedWork(toWeightedWork(doctor.weighted_work))
    setPhotoUrl(doctor.photo_url)
  }, [doctor])

  const save = async () => {
    try {
      let nextPhotoUrl = photoUrl
      if (photoFile && appUser?.tenant_id) {
        nextPhotoUrl = await uploadDoctorPhoto(appUser.tenant_id, doctor.id, photoFile)
      }
      await updateDoctor.mutateAsync({
        id: doctor.id, specialty, bio, weightedWork, isActive, photoUrl: nextPhotoUrl, scopes,
      })
      setPhotoFile(null)
      setExpanded(false)
      toast.show('Kaydedildi')
    } catch (e) {
      toast.show('Kaydedilemedi: ' + (e as Error).message, 'error')
    }
  }

  return (
    <li id={`doctor-${doctor.id}`}>
      <Card>
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <DoctorAvatar photoUrl={doctor.photo_url} name={doctor.title || 'Doktor'} />
            <div className="min-w-0">
              <p className="font-medium text-ink-primary truncate">{doctor.title || '(unvan yok)'}</p>
              <p className="text-sm text-ink-muted truncate">{doctor.specialty || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-sm text-ink-secondary">
              <span className={`leading-none ${doctor.is_active ? 'text-success-text' : 'text-ink-muted'}`} aria-hidden="true">●</span>
              {doctor.is_active ? 'Aktif' : 'Pasif'}
            </span>
            <button
              type="button"
              className="p-1.5 rounded-control text-ink-muted hover:bg-surface-1 hover:text-ink-secondary transition ease-premium duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40"
              aria-label={expanded ? 'Kapat' : 'Genişlet'}
              onClick={() => setExpanded((v) => !v)}
            >
              <ChevronIcon open={expanded} />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 pt-3 mt-3 border-t border-line">
            <ScopeChips scopes={doctor.scopes} />

            <Field label="Branş">
              <input className={inputClass} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            </Field>
            <Field label="Biyografi">
              <textarea className={inputClass} placeholder="Biyografi / CV" value={bio} onChange={(e) => setBio(e.target.value)} />
            </Field>

            <SectionHeading>Yetkinlikler</SectionHeading>
            <ScopeEditor scopes={scopes} onChange={setScopes} />

            <SectionHeading>Ağırlıklı İşler</SectionHeading>
            <WeightedWorkEditor value={weightedWork} onChange={setWeightedWork} />

            <div className="flex items-center gap-3">
              <DoctorAvatar photoUrl={photoUrl} name={doctor.title || 'Doktor'} size="lg" />
              <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Aktif
            </label>

            <SectionHeading>İstatistikler</SectionHeading>
            <StatsGrid doctor={doctor} />

            <SectionHeading>Skor Geçmişi</SectionHeading>
            <ScoreSection doctorId={doctor.id} />

            <div className="flex justify-end pt-2">
              <Button variant="primary" type="button" loading={updateDoctor.isPending} onClick={save}>
                Kaydet
              </Button>
            </div>
          </div>
        )}
      </Card>
    </li>
  )
}

/** Skorlar tablosundan tıklanan doktoru aşağıdaki karta kaydırır; kart bulunamazsa sessizce yok sayar. */
function scrollToDoctorCard(doctorId: string) {
  document.getElementById(`doctor-${doctorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function DoctorAdmin() {
  const docs = useDoctorsFull()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Doktor Yönetimi"
        actions={<Button variant="primary" onClick={() => setDialogOpen(true)}>Yeni Doktor</Button>}
      />

      <DoctorPerformanceDashboard onSelectDoctor={scrollToDoctorCard} />

      {docs.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {!docs.isLoading && docs.data?.length === 0 && (
        <EmptyState title="Henüz doktor yok" description="Yeni Doktor ile ilk kaydı oluşturun." />
      )}

      {!docs.isLoading && !!docs.data?.length && (
        <ul className="space-y-3">
          {docs.data.map((d) => <DoctorCard key={d.id} doctor={d} />)}
        </ul>
      )}

      <NewDoctorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
