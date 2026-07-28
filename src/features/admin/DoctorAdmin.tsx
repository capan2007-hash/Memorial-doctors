import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useManageUser } from './useUsers'
import { useCategories, useSubcategories } from '../catalog/useCatalog'
import { catalogName } from '../catalog/catalogName'
import {
  useDoctorsFull, useDoctorMetrics, useUpdateDoctor, useCreateDoctor,
  useUpdateDoctorIdentity, useHospitals,
  uploadDoctorPhoto, signDoctorPhoto,
  emptyWeightedWork, toWeightedWork,
  useScoreEvents,
} from './useDoctors'
import type { DoctorScope, DoctorWithScopes, HospitalRow, WeightedWork, WeightedWorkLevel } from './useDoctors'
import { doctorLabel } from '../doctor/doctorLabel'
import type { CategoryRow, SubcategoryRow } from '../../types/db'
import { netChangeInRange, monthlyNetChanges, scoreTier } from '../../domain/score'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { Icon } from '../../components/ui/Icon'
import { TranslatedText } from '../i18n-content/TranslatedText'
import { toDateInputValue, startOfDayIso, endOfDayIso } from '../../lib/format'
import { DoctorPerformanceDashboard } from './DoctorPerformanceDashboard'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Skeleton } from '@/components/shadcn/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/shadcn/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'

/** Hastane seçimi. Boş değer = hastane atanmamış (SelectItem boş string kabul etmez → NONE sentinel). */
const NO_HOSPITAL = '__none__'

function HospitalSelect({ value, onChange, hospitals, loading }: {
  value: string
  onChange: (v: string) => void
  hospitals: HospitalRow[]
  loading?: boolean
}) {
  const { t } = useTranslation('admin')
  return (
    <Select
      value={value || NO_HOSPITAL}
      onValueChange={(v) => onChange(v === NO_HOSPITAL ? '' : v)}
      disabled={loading}
    >
      <SelectTrigger>
        <SelectValue placeholder={t('doctorAdmin.fields.hospitalPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_HOSPITAL}>{t('doctorAdmin.fields.hospitalNone')}</SelectItem>
        {hospitals.map((h) => (
          <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

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

/** Bordürlü, tıklanabilir yetkinlik kutusu — seçili durumda teal vurgulu (tutarlı düzen). */
function ScopeToggle({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2 text-sm transition ease-premium duration-[var(--dur-fast)] ${
        checked
          ? 'border-brand-fill/40 bg-brand-fill/10 font-medium text-brand-text'
          : 'border-line bg-surface-2 text-ink-secondary hover:border-line-strong hover:bg-surface-1'
      }`}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="truncate">{label}</span>
    </label>
  )
}

/** Tek bir kategori bloğu: alt kırılımı yoksa tek kutu, varsa başlık + alt kırılım ızgarası. */
function CategoryScopeRow({ category, scopes, onChange }: {
  category: CategoryRow; scopes: DoctorScope[]; onChange: (next: DoctorScope[]) => void
}) {
  const { t, i18n } = useTranslation('admin')
  const subs = useSubcategories(category.has_subcategories ? category.id : undefined)
  if (!category.has_subcategories) {
    return (
      <ScopeToggle
        checked={hasScope(scopes, category.id, null)}
        label={catalogName(category, i18n.language)}
        onToggle={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: null }))}
      />
    )
  }
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{catalogName(category, i18n.language)}</p>
      {subs.data?.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {subs.data.map((sc) => (
            <ScopeToggle
              key={sc.id}
              checked={hasScope(scopes, category.id, sc.id)}
              label={catalogName(sc, i18n.language)}
              onToggle={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: sc.id }))}
            />
          ))}
        </div>
      ) : (
        <span className="text-sm text-ink-muted">{t('doctorAdmin.noSubcategories')}</span>
      )}
    </div>
  )
}

/** Kategorileri net ayrılmış bloklar halinde listeler; alt kırılımlı olanlar başlık + ızgara. */
function ScopeEditor({ scopes, onChange }: { scopes: DoctorScope[]; onChange: (next: DoctorScope[]) => void }) {
  const cats = useCategories()
  return (
    <div className="divide-y divide-line rounded-card border border-line bg-surface-1">
      {cats.data?.map((c) => (
        <div key={c.id} className="p-3">
          <CategoryScopeRow category={c} scopes={scopes} onChange={onChange} />
        </div>
      ))}
    </div>
  )
}

function WeightedWorkEditor({ value, onChange }: { value: WeightedWork; onChange: (next: WeightedWork) => void }) {
  const { t } = useTranslation('admin')
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
          <Input
            className="flex-1" placeholder={t('doctorAdmin.areaPlaceholder')}
            value={it.area} onChange={(e) => updateItem(idx, { area: e.target.value })}
          />
          <Select value={it.level} onValueChange={(v) => updateItem(idx, { level: v as WeightedWorkLevel })}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['high', 'medium', 'low'] as WeightedWorkLevel[]).map((l) => (
                <SelectItem key={l} value={l}>{t(`doctorAdmin.levelLabels.${l}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" type="button" onClick={() => removeItem(idx)}>{t('doctorAdmin.removeRowButton')}</Button>
        </div>
      ))}
      <button type="button" className="rounded text-sm font-medium text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40" onClick={addItem}>{t('doctorAdmin.addRowButton')}</button>
      <Textarea
        placeholder={t('doctorAdmin.freeNotePlaceholder')}
        value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })}
      />
    </div>
  )
}

/** Katalog kategori/alt kırılım adlarını yetkinlik çipleri için tenant kapsamında çözer (RLS zaten sınırlar). */
function useScopeLabels(lang: string) {
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
    categoryName: (id: string) => {
      const c = cats.data?.find((c) => c.id === id)
      return c ? catalogName(c, lang) : '—'
    },
    subcategoryName: (id: string) => {
      const s = subs.data?.find((s) => s.id === id)
      return s ? catalogName(s, lang) : '—'
    },
  }
}

function ScopeChips({ scopes }: { scopes: DoctorScope[] }) {
  const { t, i18n } = useTranslation('admin')
  const { categoryName, subcategoryName } = useScopeLabels(i18n.language)
  if (!scopes.length) return <p className="text-xs text-ink-muted">{t('doctorAdmin.noScopesAssigned')}</p>
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

// scoreTier (domain/score.ts) yalnız 'bg-rose-50' zeminde sabit bir uyarı etiketi döndürür ("Çalışılmaz").
// domain dosyası paylaşımlı ve değiştirilmedi; çeviri call-site'ta, tier.bg kararlı kimliğine göre yapılır.
const TIER_LABEL_KEY: Record<string, string> = { 'bg-rose-50': 'doctorAdmin.unworkableTier' }

function ScoreStatBox({ score }: { score: number }) {
  const { t } = useTranslation('admin')
  const tier = scoreTier(score)
  const tint = TIER_TINT[tier.bg] ?? { bg: 'bg-success-bg', text: 'text-success-text' }
  const tierLabelKey = TIER_LABEL_KEY[tier.bg]
  return (
    <Card className={`text-center ${tint.bg}`}>
      <p className={`font-display text-2xl tnum ${tint.text}`}>{score}</p>
      <p className="text-xs text-ink-muted">{t('doctorAdmin.stats.score')}</p>
      {tierLabelKey && <p className={`text-[11px] font-semibold mt-0.5 ${tint.text}`}>{t(tierLabelKey)}</p>}
    </Card>
  )
}

function StatsGrid({ doctor }: { doctor: DoctorWithScopes }) {
  const { t } = useTranslation('admin')
  const metrics = useDoctorMetrics(doctor.id)
  const m = metrics.data
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <StatBox value={m?.acceptCount ?? 0} label={t('doctorAdmin.stats.accept')} />
      <StatBox value={m?.rejectCount ?? 0} label={t('doctorAdmin.stats.reject')} />
      <StatBox value={m && m.avgResponseMins != null ? Math.round(m.avgResponseMins) : '—'} label={t('doctorAdmin.stats.avgResponseMins')} />
      <ScoreStatBox score={doctor.score} />
    </div>
  )
}

type ScorePreset = 'last30d' | 'custom'

/** FR-29b: zamanında/geç toplamları + dönemsel skor (preset "Son 1 ay" + serbest aralık) + son 6 ay mini liste.
 * Tek sorgu ile TÜM olaylar çekilir; aralık/aylık toplamlar istemci tarafında hesaplanır (grafik kütüphanesi yok). */
function ScoreSection({ doctorId }: { doctorId: string }) {
  const { t, i18n } = useTranslation('admin')
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
        {t('doctorAdmin.scoreSection.onTime')} <span className="font-medium text-success-text tnum">{totalTimely}</span>
        {' · '}{t('doctorAdmin.scoreSection.late')} <span className="font-medium text-danger-text tnum">{totalLate}</span>
      </p>

      <div className="rounded-control border border-line p-3 bg-surface-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={preset === 'last30d' ? 'primary' : 'secondary'}
            onClick={() => setPreset('last30d')}
          >
            {t('doctorAdmin.scoreSection.last30d')}
          </Button>
          <Input
            type="date"
            className="w-auto"
            value={customFrom}
            onChange={(e) => { setCustomFrom(e.target.value); setPreset('custom') }}
          />
          <span className="text-sm text-ink-muted">–</span>
          <Input
            type="date"
            className="w-auto"
            value={customTo}
            onChange={(e) => { setCustomTo(e.target.value); setPreset('custom') }}
          />
        </div>
        <p className="text-sm text-ink-secondary">
          {t('doctorAdmin.scoreSection.rangeChange')} <span className="text-success-text font-medium tnum">+{range.positive}</span>
          {' '}<span className="text-danger-text font-medium tnum">−{range.negative}</span>
          {' = '}
          <span className="font-semibold tnum">{t('doctorAdmin.scoreSection.net')} {range.net >= 0 ? `+${range.net}` : range.net}</span>
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-ink-muted mb-1">{t('doctorAdmin.scoreSection.last6Months')}</p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-secondary">
          {monthly.map((m) => {
            // m.label (domain/score.ts) sabit TR ay kısaltması döndürür; domain dosyası değiştirilmedi —
            // görüntüleme yalnız m.key ("YYYY-MM") tarih kimliğinden aktif dile göre yeniden formatlanır.
            const [y, mo] = m.key.split('-').map(Number)
            const label = new Intl.DateTimeFormat(i18n.language, { month: 'short', year: 'numeric' }).format(new Date(y, mo - 1, 1))
            return (
              <li key={m.key}>
                {label}: <span className={`tnum ${m.net > 0 ? 'text-success-text' : m.net < 0 ? 'text-danger-text' : 'text-ink-muted'}`}>
                  {m.net > 0 ? `+${m.net}` : m.net}
                </span>
              </li>
            )
          })}
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
  const { t } = useTranslation('admin')
  const { appUser } = useAuth()
  const toast = useToast()
  const createDoctor = useCreateDoctor()
  const hospitals = useHospitals()
  const [hospitalId, setHospitalId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')
  const [scopes, setScopes] = useState<DoctorScope[]>([])
  const [weightedWork, setWeightedWork] = useState<WeightedWork>(emptyWeightedWork)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const canSubmit = !!email && !!password && !!fullName && scopes.length > 0 && !createDoctor.isPending

  const reset = () => {
    setEmail(''); setPassword(''); setFullName(''); setTitle(''); setSpecialty(''); setBio('')
    setScopes([]); setWeightedWork(emptyWeightedWork); setPhotoFile(null); setHospitalId('')
  }

  const submit = async () => {
    try {
      const result = await createDoctor.mutateAsync({
        email, password, fullName, title, specialty, bio, weightedWork, scopes,
        hospitalId: hospitalId || null,
      })
      const newDoctorId = result?.doctorId ?? result?.doctor?.id
      if (photoFile && newDoctorId && appUser?.tenant_id) {
        const path = await uploadDoctorPhoto(appUser.tenant_id, newDoctorId, photoFile)
        await supabase.from('doctor').update({ photo_url: path }).eq('id', newDoctorId)
      }
      reset()
      toast.show(t('doctorAdmin.createdToast'))
      onClose()
    } catch (e) {
      toast.show(t('doctorAdmin.createFailedToast', { message: (e as Error).message }), 'error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl space-y-3 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{t('doctorAdmin.newDoctorDialogTitle')}</DialogTitle>
        </DialogHeader>

        <SectionHeading>{t('doctorAdmin.sections.account')}</SectionHeading>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('doctorAdmin.fields.email')}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t('doctorAdmin.fields.tempPassword')}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>

        <SectionHeading>{t('doctorAdmin.sections.profile')}</SectionHeading>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('doctorAdmin.fields.fullName')}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label={t('doctorAdmin.fields.title')}>
            <Input placeholder={t('doctorAdmin.fields.titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('doctorAdmin.fields.hospital')}>
            <HospitalSelect
              value={hospitalId}
              onChange={setHospitalId}
              hospitals={hospitals.data ?? []}
              loading={hospitals.isLoading}
            />
          </Field>
          <Field label={t('doctorAdmin.fields.specialty')}>
            <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </Field>
        </div>
        <Field label={t('doctorAdmin.fields.bio')}>
          <Textarea placeholder={t('doctorAdmin.fields.bioPlaceholder')} value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>

        <SectionHeading>{t('doctorAdmin.sections.skills')}</SectionHeading>
        <ScopeEditor scopes={scopes} onChange={setScopes} />
        {!scopes.length && <p className="text-xs text-warning-text">{t('doctorAdmin.scopesMinWarning')}</p>}

        <SectionHeading>{t('doctorAdmin.sections.weightedWork')}</SectionHeading>
        <WeightedWorkEditor value={weightedWork} onChange={setWeightedWork} />

        <SectionHeading>{t('doctorAdmin.sections.photo')}</SectionHeading>
        <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="block text-sm" />

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>{t('doctorAdmin.cancelButton')}</Button>
          <Button variant="primary" type="button" disabled={!canSubmit} loading={createDoctor.isPending} onClick={submit}>
            {t('doctorAdmin.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmDeleteDialog({ loading, onConfirm, onClose }: {
  loading: boolean; onConfirm: () => void; onClose: () => void
}) {
  const { t } = useTranslation('admin')
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{t('doctorAdmin.confirmDeleteTitle')}</DialogTitle>
          <DialogDescription>
            {t('doctorAdmin.confirmDeleteDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>{t('doctorAdmin.cancelButton')}</Button>
          <Button variant="danger" type="button" loading={loading} onClick={onConfirm}>{t('doctorAdmin.deleteButton')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DoctorCard({ doctor }: { doctor: DoctorWithScopes }) {
  const { t } = useTranslation('admin')
  const { appUser, role } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const manageUser = useManageUser()
  const updateDoctor = useUpdateDoctor()
  const updateDoctorIdentity = useUpdateDoctorIdentity()
  const hospitals = useHospitals()
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const canDelete = role === 'admin' || role === 'super_admin'

  const doDelete = async () => {
    if (!doctor.app_user_id) {
      toast.show(t('doctorAdmin.noAccountError'), 'error')
      return
    }
    try {
      await manageUser.mutateAsync({ userId: doctor.app_user_id, action: 'delete_doctor' })
      toast.show(t('doctorAdmin.deletedToast'))
      qc.invalidateQueries({ queryKey: ['doctors'] })
      setConfirmDelete(false)
    } catch (e) {
      toast.show(t('doctorAdmin.deleteFailedToast', { message: (e as Error).message }), 'error')
    }
  }
  const [fullName, setFullName] = useState(doctor.fullName ?? '')
  const [title, setTitle] = useState(doctor.title ?? '')
  const [hospitalId, setHospitalId] = useState<string>(doctor.hospitalId ?? '')
  const [specialty, setSpecialty] = useState(doctor.specialty ?? '')
  const [bio, setBio] = useState(doctor.bio ?? '')
  const [isActive, setIsActive] = useState(doctor.is_active)
  const [scopes, setScopes] = useState<DoctorScope[]>(doctor.scopes)
  const [weightedWork, setWeightedWork] = useState<WeightedWork>(toWeightedWork(doctor.weighted_work))
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(doctor.photo_url)

  useEffect(() => {
    setFullName(doctor.fullName ?? ''); setTitle(doctor.title ?? ''); setHospitalId(doctor.hospitalId ?? '')
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
      // Kimlik alanları (ad/unvan/branş/hastane) RPC ile: ad app_user'da ve o tabloda
      // UPDATE policy'si yok. Diğer profil alanları doctor tablosuna doğrudan yazılır.
      await updateDoctorIdentity.mutateAsync({
        doctorId: doctor.id, fullName, title, specialty, hospitalId: hospitalId || null,
      })
      await updateDoctor.mutateAsync({
        id: doctor.id, bio, weightedWork, isActive, photoUrl: nextPhotoUrl, scopes,
      })
      setPhotoFile(null)
      setExpanded(false)
      toast.show(t('doctorAdmin.savedToast'))
    } catch (e) {
      toast.show(t('doctorAdmin.saveFailedToast', { message: (e as Error).message }), 'error')
    }
  }

  // Kart başlığı: unvan + ad (ad yoksa yalnız unvan).
  const headerName = doctorLabel(doctor.title, doctor.fullName)

  return (
    <li id={`doctor-${doctor.id}`}>
      <Card>
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <DoctorAvatar photoUrl={doctor.photo_url} name={headerName || t('doctorAdmin.avatarFallbackName')} />
            <div className="min-w-0">
              {/* Başlık: "Op. Dr. Ayşe Yılmaz" — unvan zaten adın içindeyse tekrarlanmaz (doctorLabel). */}
              {headerName ? (
                <p className="font-medium text-ink-primary truncate">{headerName}</p>
              ) : (
                <p className="font-medium text-ink-primary truncate">{t('doctorAdmin.noTitle')}</p>
              )}
              <p className="text-sm text-ink-muted truncate">
                {doctor.specialty ? (
                  <TranslatedText as="span" text={doctor.specialty} sourceLang="tr" compact />
                ) : (
                  '—'
                )}
                {doctor.hospitalName ? ` · ${doctor.hospitalName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-sm text-ink-secondary">
              <span className={`leading-none ${doctor.is_active ? 'text-success-text' : 'text-ink-muted'}`} aria-hidden="true">●</span>
              {doctor.is_active ? t('doctorAdmin.activeLabel') : t('doctorAdmin.inactiveLabel')}
            </span>
            {canDelete && (
              <Button
                variant="ghost"
                type="button"
                className="text-danger-text hover:bg-danger-bg"
                onClick={() => setConfirmDelete(true)}
              >
                <Icon of={Trash2} size={15} /> {t('doctorAdmin.deleteButton')}
              </Button>
            )}
            <button
              type="button"
              className="p-1.5 rounded-control text-ink-muted hover:bg-surface-1 hover:text-ink-secondary transition ease-premium duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40"
              aria-label={expanded ? t('doctorAdmin.collapseAria') : t('doctorAdmin.expandAria')}
              onClick={() => setExpanded((v) => !v)}
            >
              <ChevronIcon open={expanded} />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 pt-3 mt-3 border-t border-line">
            <ScopeChips scopes={doctor.scopes} />

            <Field label={t('doctorAdmin.fields.fullName')}>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label={t('doctorAdmin.fields.title')}>
              <Input placeholder={t('doctorAdmin.fields.titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label={t('doctorAdmin.fields.hospital')}>
              <HospitalSelect
                value={hospitalId}
                onChange={setHospitalId}
                hospitals={hospitals.data ?? []}
                loading={hospitals.isLoading}
              />
            </Field>
            <Field label={t('doctorAdmin.fields.specialty')}>
              <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            </Field>
            <Field label={t('doctorAdmin.fields.bio')}>
              <Textarea placeholder={t('doctorAdmin.fields.bioPlaceholder')} value={bio} onChange={(e) => setBio(e.target.value)} />
            </Field>

            <SectionHeading>{t('doctorAdmin.sections.skills')}</SectionHeading>
            <ScopeEditor scopes={scopes} onChange={setScopes} />

            <SectionHeading>{t('doctorAdmin.sections.weightedWork')}</SectionHeading>
            <WeightedWorkEditor value={weightedWork} onChange={setWeightedWork} />

            <div className="flex items-center gap-3">
              <DoctorAvatar photoUrl={photoUrl} name={doctor.title || t('doctorAdmin.avatarFallbackName')} size="lg" />
              <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="text-sm" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
              <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} /> {t('doctorAdmin.activeLabel')}
            </label>

            <SectionHeading>{t('doctorAdmin.sections.statistics')}</SectionHeading>
            <StatsGrid doctor={doctor} />

            <SectionHeading>{t('doctorAdmin.sections.scoreHistory')}</SectionHeading>
            <ScoreSection doctorId={doctor.id} />

            <div className="flex justify-end pt-2">
              <Button variant="primary" type="button" loading={updateDoctor.isPending} onClick={save}>
                {t('doctorAdmin.saveButton')}
              </Button>
            </div>
          </div>
        )}
      </Card>
      {confirmDelete && (
        <ConfirmDeleteDialog
          loading={manageUser.isPending}
          onConfirm={doDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </li>
  )
}

/** Skorlar tablosundan tıklanan doktoru aşağıdaki karta kaydırır; kart bulunamazsa sessizce yok sayar. */
function scrollToDoctorCard(doctorId: string) {
  document.getElementById(`doctor-${doctorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function DoctorAdmin() {
  const { t } = useTranslation('admin')
  const docs = useDoctorsFull()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [view, setView] = useState<'list' | 'reports'>('list')

  // Raporlama tablosundan doktora tıklanınca: liste sekmesine geç + karta kaydır.
  const openDoctorCard = (doctorId: string) => {
    setView('list')
    setTimeout(() => scrollToDoctorCard(doctorId), 120)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('doctorAdmin.title')}
        actions={<Button variant="primary" onClick={() => setDialogOpen(true)}>{t('doctorAdmin.newDoctorButton')}</Button>}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'reports')} className="block">
        <TabsList>
          <TabsTrigger value="list">{t('doctorAdmin.tabs.list')}</TabsTrigger>
          <TabsTrigger value="reports">{t('doctorAdmin.tabs.reports')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'reports' ? (
        <DoctorPerformanceDashboard onSelectDoctor={openDoctorCard} />
      ) : (
        <>
          {docs.isLoading && (
            <ul className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="rounded-card border border-line bg-surface-2 p-4 shadow-card md:p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!docs.isLoading && docs.data?.length === 0 && (
            <EmptyState title={t('doctorAdmin.emptyTitle')} description={t('doctorAdmin.emptyDescription')} />
          )}

          {!docs.isLoading && !!docs.data?.length && (
            <ul className="space-y-3">
              {docs.data.map((d) => <DoctorCard key={d.id} doctor={d} />)}
            </ul>
          )}
        </>
      )}

      <NewDoctorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
