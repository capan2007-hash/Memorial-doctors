import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useCategories, useSubcategories } from '../catalog/useCatalog'
import {
  uploadDoctorPhoto, signDoctorPhoto,
  emptyWeightedWork, toWeightedWork,
} from '../admin/useDoctors'
import type { DoctorScope, WeightedWork, WeightedWorkLevel } from '../admin/useDoctors'
import { useOwnDoctor, useOwnPerformance, useUpdateOwnProfile, useSetOwnScopes } from './useOwnProfile'
import type { OwnPerformance } from './useOwnProfile'
import type { CategoryRow } from '../../types/db'
import { scoreTier } from '../../domain/score'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { formatMins } from '../../lib/format'

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

/** Tek kategori satırı: alt kırılım yoksa kategori çipi, varsa alt kırılım çip listesi (DoctorAdmin deseni). */
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
            className={`${inputClass} flex-1 text-sm`} placeholder="Alan (ör. rinoplasti)"
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
      <button
        type="button"
        className="text-sm text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40 rounded"
        onClick={addItem}
      >
        + Satır ekle
      </button>
      <textarea
        className={`${inputClass} text-sm`} placeholder="Serbest not"
        value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })}
      />
    </div>
  )
}

/** Depo yolundan imzalı URL çözüp Avatar'a besler; foto yoksa baş harfler. */
function ProfileAvatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const q = useQuery({
    queryKey: ['doctor-photo-signed', photoUrl],
    enabled: !!photoUrl,
    queryFn: () => signDoctorPhoto(photoUrl!),
  })
  return <Avatar src={photoUrl ? q.data : undefined} name={name} size="lg" />
}

/** scoreTier zeminini (score.ts) yüzey-üstü semantik tinte eşler — eşik mantığı tekrarlanmaz. */
const TIER_TINT: Record<string, { bg: string; text: string }> = {
  'bg-rose-50': { bg: 'bg-danger-bg', text: 'text-danger-text' },
  'bg-amber-50': { bg: 'bg-warning-bg', text: 'text-warning-text' },
  'bg-brand-50': { bg: 'bg-success-bg', text: 'text-success-text' },
}

function MetricTile({ value, label, tint }: { value: string | number; label: string; tint?: 'danger' }) {
  const bg = tint === 'danger' ? 'bg-danger-bg' : ''
  const valueColor = tint === 'danger' ? 'text-danger-text' : 'text-ink-primary'
  return (
    <div className={`rounded-control border border-line p-3 text-center ${bg}`}>
      <p className={`font-display text-2xl tnum ${valueColor}`}>{value}</p>
      <p className="text-xs text-ink-muted mt-0.5">{label}</p>
    </div>
  )
}

function ScoreTile({ score }: { score: number }) {
  const tier = scoreTier(score)
  const tint = TIER_TINT[tier.bg] ?? { bg: 'bg-success-bg', text: 'text-success-text' }
  return (
    <div className={`rounded-control border border-line p-3 text-center ${tint.bg}`}>
      <p className={`font-display text-2xl tnum ${tint.text}`}>{score}</p>
      <p className="text-xs text-ink-muted mt-0.5">Skor</p>
      {tier.label && <p className={`text-[11px] font-semibold mt-0.5 ${tint.text}`}>{tier.label}</p>}
    </div>
  )
}

function PerformanceSection({ perf }: { perf: OwnPerformance }) {
  const incoming = perf.accept_count + perf.reject_count + perf.pending_count
  const answered = perf.accept_count + perf.reject_count
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricTile value={incoming} label="Gelen" />
        <MetricTile value={answered} label="Cevaplanan" />
        <MetricTile value={perf.avg_response_mins != null ? formatMins(perf.avg_response_mins) : '—'} label="Ort. yanıt" />
        <MetricTile value={perf.breach_count} label="Hedef dışı" tint={perf.breach_count > 0 ? 'danger' : undefined} />
        <MetricTile value={perf.pending_count} label="Bekleyen" />
        <ScoreTile score={perf.score} />
      </div>
      <p className="text-sm text-ink-secondary">
        Zamanında: <span className="font-medium text-success-text tnum">{perf.timely_count}</span>
        {' · '}Geç: <span className="font-medium text-danger-text tnum">{perf.breach_count}</span>
      </p>
    </div>
  )
}

export function DoctorProfile() {
  const { appUser } = useAuth()
  const toast = useToast()
  const own = useOwnDoctor()
  const perf = useOwnPerformance()
  const updateProfile = useUpdateOwnProfile()
  const setScopes = useSetOwnScopes()

  const doctor = own.data?.doctor ?? null

  const [title, setTitle] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')
  const [weightedWork, setWeightedWork] = useState<WeightedWork>(emptyWeightedWork)
  const [scopes, setScopesState] = useState<DoctorScope[]>([])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!own.data) return
    setTitle(own.data.doctor.title ?? '')
    setSpecialty(own.data.doctor.specialty ?? '')
    setBio(own.data.doctor.bio ?? '')
    setWeightedWork(toWeightedWork(own.data.doctor.weighted_work))
    setScopesState(own.data.scopes)
    setPhotoUrl(own.data.doctor.photo_url)
  }, [own.data])

  const saveProfile = async () => {
    if (!doctor) return
    try {
      let nextPhotoUrl = photoUrl
      if (photoFile && appUser?.tenant_id) {
        nextPhotoUrl = await uploadDoctorPhoto(appUser.tenant_id, doctor.id, photoFile)
      }
      await updateProfile.mutateAsync({
        title: title || null,
        specialty: specialty || null,
        bio: bio || null,
        weightedWork,
        photoUrl: nextPhotoUrl,
      })
      setPhotoFile(null)
      setPhotoUrl(nextPhotoUrl)
      toast.show('Profil kaydedildi')
    } catch (e) {
      toast.show('Kaydedilemedi: ' + (e as Error).message, 'error')
    }
  }

  const saveScopes = async () => {
    if (!scopes.length) {
      toast.show('En az bir yetkinlik seçmelisiniz', 'error')
      return
    }
    try {
      await setScopes.mutateAsync(scopes)
      toast.show('Yetkinlikler kaydedildi')
    } catch (e) {
      toast.show('Kaydedilemedi: ' + (e as Error).message, 'error')
    }
  }

  if (own.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  if (!doctor) {
    return (
      <div className="space-y-4">
        <PageHeader title="Profilim" />
        <EmptyState title="Profil bulunamadı" description="Doktor kaydınıza ulaşılamadı." />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Profilim" subtitle="Profilinizi, verebileceğiniz tedavileri ve performansınızı yönetin." />

      <Card title="Profil" className="space-y-3">
        <div className="flex items-center gap-4">
          <ProfileAvatar photoUrl={photoUrl} name={title || 'Doktor'} />
          <div>
            <label className="inline-block">
              <span className="sr-only">Fotoğraf seç</span>
              <input
                type="file" accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="block text-sm text-ink-secondary"
              />
            </label>
            {photoFile && <p className="text-xs text-ink-muted mt-1">Kaydet'e basınca yüklenecek: {photoFile.name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

        <div>
          <p className="text-sm font-semibold text-ink-secondary mb-1">Ağırlıklı İşler</p>
          <WeightedWorkEditor value={weightedWork} onChange={setWeightedWork} />
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="primary" type="button" loading={updateProfile.isPending} onClick={saveProfile}>
            Kaydet
          </Button>
        </div>
      </Card>

      <Card title="Yetkinlikler (verebileceğim tedaviler)" className="space-y-3">
        <p className="text-sm text-ink-secondary">Bu tedaviler için yeni talepler size gönderilir.</p>
        <ScopeEditor scopes={scopes} onChange={setScopesState} />
        {!scopes.length && <p className="text-warning-text text-xs">En az bir yetkinlik seçilmeli.</p>}
        <div className="flex justify-end pt-1">
          <Button
            variant="primary" type="button"
            disabled={!scopes.length}
            loading={setScopes.isPending}
            onClick={saveScopes}
          >
            Onayla ve kaydet
          </Button>
        </div>
      </Card>

      <Card title="Performansım">
        {perf.isLoading && (
          <div className="flex justify-center py-6"><Spinner /></div>
        )}
        {!perf.isLoading && perf.data && <PerformanceSection perf={perf.data} />}
        {!perf.isLoading && !perf.data && (
          <p className="text-sm text-ink-muted">Henüz performans verisi yok.</p>
        )}
      </Card>
    </div>
  )
}
