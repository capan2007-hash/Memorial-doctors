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
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { Icon } from '../../components/ui/Icon'
import { Upload, Check, Plus } from 'lucide-react'
import { formatMins } from '../../lib/format'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { Skeleton } from '@/components/shadcn/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'

const levelLabels: Record<WeightedWorkLevel, string> = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' }

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

/** Seçilebilir yetkinlik çipi: gizli checkbox + pill; seçiliyken teal tint + onay işareti. */
function ScopeChip({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <label
      className={`inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-[var(--dur-fast)] ease-premium ${
        checked
          ? 'border-brand-fill bg-brand-fill/10 font-medium text-brand-text'
          : 'border-line bg-surface-1 text-ink-secondary hover:border-line-strong hover:text-ink-primary'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
          checked ? 'border-brand-fill bg-brand-fill text-brand-on' : 'border-line-strong'
        }`}
      >
        {checked && <Icon of={Check} size={11} />}
      </span>
      {label}
    </label>
  )
}

/** Alt kırılımı olan kategori: küçük başlık + alt kırılım çipleri. */
function GroupedScope({ category, scopes, onChange }: {
  category: CategoryRow; scopes: DoctorScope[]; onChange: (next: DoctorScope[]) => void
}) {
  const subs = useSubcategories(category.id)
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{category.name}</p>
      <div className="flex flex-wrap gap-2">
        {subs.data?.map((sc) => (
          <ScopeChip
            key={sc.id}
            label={sc.name}
            checked={hasScope(scopes, category.id, sc.id)}
            onToggle={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: sc.id }))}
          />
        ))}
        {!subs.data?.length && <span className="text-sm text-ink-muted">Alt kırılım yok</span>}
      </div>
    </div>
  )
}

/** Alt kırılımsız kategoriler tek çip satırında; alt kırılımlılar ayrı başlıklı gruplar. */
function ScopeEditor({ scopes, onChange }: { scopes: DoctorScope[]; onChange: (next: DoctorScope[]) => void }) {
  const cats = useCategories()
  const list = cats.data ?? []
  const standalone = list.filter((c) => !c.has_subcategories)
  const grouped = list.filter((c) => c.has_subcategories)
  return (
    <div className="space-y-5">
      {standalone.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {standalone.map((c) => (
            <ScopeChip
              key={c.id}
              label={c.name}
              checked={hasScope(scopes, c.id, null)}
              onToggle={() => onChange(toggleScope(scopes, { categoryId: c.id, subcategoryId: null }))}
            />
          ))}
        </div>
      )}
      {grouped.map((c) => (
        <GroupedScope key={c.id} category={c} scopes={scopes} onChange={onChange} />
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
    <div className="space-y-3">
      {value.items.length === 0 ? (
        <p className="text-sm text-ink-muted">Henüz ağırlıklı iş eklemediniz.</p>
      ) : (
        <div className="space-y-2">
          {value.items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                className="flex-1" placeholder="Alan (ör. rinoplasti)"
                value={it.area} onChange={(e) => updateItem(idx, { area: e.target.value })}
              />
              <Select value={it.level} onValueChange={(v) => updateItem(idx, { level: v as WeightedWorkLevel })}>
                <SelectTrigger className="w-28 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['high', 'medium', 'low'] as WeightedWorkLevel[]).map((l) => (
                    <SelectItem key={l} value={l}>{levelLabels[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" type="button" onClick={() => removeItem(idx)}>Sil</Button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-control border border-dashed border-line-strong px-3 py-1.5 text-sm text-brand-text transition-colors duration-[var(--dur-fast)] ease-premium hover:bg-brand-fill/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40"
        onClick={addItem}
      >
        <Icon of={Plus} size={15} /> Satır ekle
      </button>
      <div className="pt-1">
        <label className="mb-1 block text-xs font-medium text-ink-muted">Serbest not</label>
        <Textarea
          placeholder="Öne çıkan deneyim, ilgi alanı…"
          value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </div>
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
    <div className={`rounded-control border border-line p-4 text-center ${bg}`}>
      <p className={`font-display text-2xl tnum ${valueColor}`}>{value}</p>
      <p className="text-xs text-ink-muted mt-1">{label}</p>
    </div>
  )
}

function ScoreTile({ score }: { score: number }) {
  const tier = scoreTier(score)
  const tint = TIER_TINT[tier.bg] ?? { bg: 'bg-success-bg', text: 'text-success-text' }
  return (
    <div className={`rounded-control border border-line p-4 text-center ${tint.bg}`}>
      <p className={`font-display text-2xl tnum ${tint.text}`}>{score}</p>
      <p className="text-xs text-ink-muted mt-1">Skor</p>
      {tier.label && <p className={`text-[11px] font-semibold mt-0.5 ${tint.text}`}>{tier.label}</p>}
    </div>
  )
}

function PerformanceSection({ perf }: { perf: OwnPerformance }) {
  const incoming = perf.accept_count + perf.reject_count + perf.pending_count
  const answered = perf.accept_count + perf.reject_count
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface-2 p-4 shadow-card md:p-5">
            <Skeleton className="mb-3 h-5 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          </div>
        ))}
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
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink-primary transition-colors duration-[var(--dur-fast)] ease-premium hover:border-line-strong">
              <Icon of={Upload} size={15} />
              Fotoğraf seç
              <input
                type="file" accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
            {photoFile && <p className="mt-1 text-xs text-ink-muted">Kaydet'e basınca yüklenecek: {photoFile.name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Unvan">
            <Input placeholder="ör. Op. Dr." value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Branş">
            <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </Field>
        </div>
        <Field label="Biyografi">
          <Textarea placeholder="Biyografi / CV" value={bio} onChange={(e) => setBio(e.target.value)} />
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

      <Card title="Yetkinlikler (verebileceğim tedaviler)" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-secondary">Bu tedaviler için yeni talepler size gönderilir.</p>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-secondary tnum">
            {scopes.length} seçili
          </span>
        </div>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-control" />
            ))}
          </div>
        )}
        {!perf.isLoading && perf.data && <PerformanceSection perf={perf.data} />}
        {!perf.isLoading && !perf.data && (
          <p className="text-sm text-ink-muted">Henüz performans verisi yok.</p>
        )}
      </Card>
    </div>
  )
}
