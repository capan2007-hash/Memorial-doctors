import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useCategories, useSubcategories } from '../catalog/useCatalog'
import {
  useDoctorsFull, useDoctorMetrics, useUpdateDoctor, useCreateDoctor,
  uploadDoctorPhoto, signDoctorPhoto,
  emptyWeightedWork, toWeightedWork,
} from './useDoctors'
import type { DoctorScope, DoctorWithScopes, WeightedWork, WeightedWorkLevel } from './useDoctors'
import type { CategoryRow } from '../../types/db'

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

/** Tek bir kategori satırı: alt kırılımı yoksa kategori checkbox'ı, varsa alt kırılım çoklu checkbox listesi. */
function CategoryScopeRow({ category, scopes, onChange }: {
  category: CategoryRow; scopes: DoctorScope[]; onChange: (next: DoctorScope[]) => void
}) {
  const subs = useSubcategories(category.has_subcategories ? category.id : undefined)
  if (!category.has_subcategories) {
    return (
      <label className="flex items-center gap-2 text-sm">
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
      <p className="font-medium text-slate-700">{category.name}</p>
      <div className="mt-1 ml-3 flex flex-wrap gap-3">
        {subs.data?.map((sc) => (
          <label key={sc.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasScope(scopes, category.id, sc.id)}
              onChange={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: sc.id }))}
            />
            {sc.name}
          </label>
        ))}
        {!subs.data?.length && <span className="text-slate-400">Alt kırılım yok</span>}
      </div>
    </div>
  )
}

function ScopeEditor({ scopes, onChange }: { scopes: DoctorScope[]; onChange: (next: DoctorScope[]) => void }) {
  const cats = useCategories()
  return (
    <div className="space-y-2 border rounded p-2 bg-slate-50">
      <p className="text-xs text-slate-500">Yetkinlikler (kategori / alt kırılım)</p>
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
    <div className="space-y-2 border rounded p-2 bg-slate-50">
      <p className="text-xs text-slate-500">Ağırlıklı işler</p>
      {value.items.map((it, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            className="border rounded p-1 flex-1 text-sm" placeholder="Alan (ör. diz protezi)"
            value={it.area} onChange={(e) => updateItem(idx, { area: e.target.value })}
          />
          <select
            className="border rounded p-1 text-sm" value={it.level}
            onChange={(e) => updateItem(idx, { level: e.target.value as WeightedWorkLevel })}
          >
            {(['high', 'medium', 'low'] as WeightedWorkLevel[]).map((l) => (
              <option key={l} value={l}>{levelLabels[l]}</option>
            ))}
          </select>
          <button type="button" className="text-red-600 text-sm" onClick={() => removeItem(idx)}>Sil</button>
        </div>
      ))}
      <button type="button" className="underline text-sm" onClick={addItem}>+ Satır ekle</button>
      <textarea
        className="w-full border rounded p-2 text-sm" placeholder="Serbest not"
        value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })}
      />
    </div>
  )
}

function DoctorPhoto({ photoUrl, className }: { photoUrl: string | null; className?: string }) {
  const q = useQuery({
    queryKey: ['doctor-photo-signed', photoUrl],
    enabled: !!photoUrl,
    queryFn: () => signDoctorPhoto(photoUrl!),
  })
  if (!photoUrl) return <div className={`${className} bg-slate-200 rounded flex items-center justify-center text-slate-400 text-xs`}>Foto yok</div>
  if (!q.data) return <div className={`${className} bg-slate-100 rounded`} />
  return <img src={q.data} className={`${className} rounded object-cover`} alt="doktor fotoğrafı" />
}

function PerformancePanel({ doctor }: { doctor: DoctorWithScopes }) {
  const metrics = useDoctorMetrics(doctor.id)
  const m = metrics.data
  return (
    <p className="text-xs text-slate-500">
      Kabul: {m?.acceptCount ?? 0} · Red: {m?.rejectCount ?? 0} · Ort. dönüş:{' '}
      {m && m.avgResponseMins != null ? `${Math.round(m.avgResponseMins)} dk` : '—'} · Skor: {doctor.score}
    </p>
  )
}

function NewDoctorForm() {
  const { appUser } = useAuth()
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
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !!email && !!password && !!fullName && scopes.length > 0 && !createDoctor.isPending

  const reset = () => {
    setEmail(''); setPassword(''); setFullName(''); setTitle(''); setSpecialty(''); setBio('')
    setScopes([]); setWeightedWork(emptyWeightedWork); setPhotoFile(null)
  }

  const submit = async () => {
    setError(null)
    try {
      const result = await createDoctor.mutateAsync({ email, password, fullName, title, specialty, bio, weightedWork, scopes })
      const newDoctorId = result?.doctorId ?? result?.doctor?.id
      if (photoFile && newDoctorId && appUser?.tenant_id) {
        const path = await uploadDoctorPhoto(appUser.tenant_id, newDoctorId, photoFile)
        await supabase.from('doctor').update({ photo_url: path }).eq('id', newDoctorId)
      }
      reset()
    } catch (e) {
      setError('Doktor oluşturulamadı: ' + (e as Error).message)
    }
  }

  return (
    <div className="border rounded p-3 bg-white space-y-2">
      <h3 className="font-medium">Yeni Doktor Ekle</h3>
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border rounded p-2" placeholder="Geçici şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="border rounded p-2" placeholder="Ad Soyad" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className="border rounded p-2" placeholder="Unvan (ör. Op. Dr.)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="border rounded p-2 col-span-2" placeholder="Branş" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
      </div>
      <textarea className="w-full border rounded p-2" placeholder="Biyografi / CV" value={bio} onChange={(e) => setBio(e.target.value)} />
      <ScopeEditor scopes={scopes} onChange={setScopes} />
      <WeightedWorkEditor value={weightedWork} onChange={setWeightedWork} />
      <div>
        <label className="text-sm text-slate-600">Fotoğraf (opsiyonel)</label>
        <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="block text-sm" />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!scopes.length && <p className="text-amber-600 text-xs">En az bir yetkinlik (kategori/alt kırılım) seçilmeli.</p>}
      <button disabled={!canSubmit} className="bg-slate-800 text-white rounded px-3 py-2 disabled:opacity-40" onClick={submit}>
        {createDoctor.isPending ? 'Oluşturuluyor…' : 'Doktor Oluştur'}
      </button>
    </div>
  )
}

function DoctorCard({ doctor }: { doctor: DoctorWithScopes }) {
  const { appUser } = useAuth()
  const updateDoctor = useUpdateDoctor()
  const [expanded, setExpanded] = useState(false)
  const [specialty, setSpecialty] = useState(doctor.specialty ?? '')
  const [bio, setBio] = useState(doctor.bio ?? '')
  const [isActive, setIsActive] = useState(doctor.is_active)
  const [scopes, setScopes] = useState<DoctorScope[]>(doctor.scopes)
  const [weightedWork, setWeightedWork] = useState<WeightedWork>(toWeightedWork(doctor.weighted_work))
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(doctor.photo_url)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSpecialty(doctor.specialty ?? ''); setBio(doctor.bio ?? ''); setIsActive(doctor.is_active)
    setScopes(doctor.scopes); setWeightedWork(toWeightedWork(doctor.weighted_work))
    setPhotoUrl(doctor.photo_url)
  }, [doctor])

  const save = async () => {
    setError(null)
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
    } catch (e) {
      setError('Kaydedilemedi: ' + (e as Error).message)
    }
  }

  const toggleActiveOnly = () => updateDoctor.mutate({ id: doctor.id, isActive: !doctor.is_active, scopes: doctor.scopes })

  return (
    <li className="border rounded p-3 bg-white space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <DoctorPhoto photoUrl={doctor.photo_url} className="w-10 h-10" />
          <div>
            <p className="font-medium">{doctor.title || '(unvan yok)'} {!doctor.is_active && <span className="text-slate-400 text-sm">(pasif)</span>}</p>
            <p className="text-sm text-slate-600">{doctor.specialty || '—'}</p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button className="underline text-sm" onClick={toggleActiveOnly}>{doctor.is_active ? 'Pasifleştir' : 'Aktifleştir'}</button>
          <button className="underline text-sm" onClick={() => setExpanded((v) => !v)}>{expanded ? 'Kapat' : 'Düzenle'}</button>
        </div>
      </div>

      <PerformancePanel doctor={doctor} />

      {expanded && (
        <div className="space-y-2 pt-2 border-t">
          <input className="w-full border rounded p-2" placeholder="Branş" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          <textarea className="w-full border rounded p-2" placeholder="Biyografi / CV" value={bio} onChange={(e) => setBio(e.target.value)} />
          <ScopeEditor scopes={scopes} onChange={setScopes} />
          <WeightedWorkEditor value={weightedWork} onChange={setWeightedWork} />
          <div className="flex items-center gap-3">
            <DoctorPhoto photoUrl={photoUrl} className="w-14 h-14" />
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Aktif
          </label>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button disabled={updateDoctor.isPending} className="bg-slate-800 text-white rounded px-3 py-2 disabled:opacity-40" onClick={save}>
            {updateDoctor.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      )}
    </li>
  )
}

export function DoctorAdmin() {
  const docs = useDoctorsFull()
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Doktor Yönetimi</h2>
      <NewDoctorForm />
      {docs.isLoading && <p className="text-sm text-slate-500">Yükleniyor…</p>}
      <ul className="space-y-2">
        {docs.data?.map((d) => <DoctorCard key={d.id} doctor={d} />)}
      </ul>
    </div>
  )
}
