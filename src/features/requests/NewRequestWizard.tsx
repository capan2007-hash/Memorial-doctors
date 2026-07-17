import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useCategories, useSubcategories, useOperationTypes } from '../catalog/useCatalog'
import { useCreateRequest } from './useRequests'
import { PhotoUploader } from '../../components/PhotoUploader'

export function NewRequestWizard() {
  const { appUser } = useAuth()
  const nav = useNavigate()
  const cats = useCategories()
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null)
  const [operationTypeId, setOperationTypeId] = useState<string | null>(null)
  const [first, setFirst] = useState(''); const [last, setLast] = useState('')
  const [notes, setNotes] = useState(''); const [files, setFiles] = useState<File[]>([])
  const [warn, setWarn] = useState<string | null>(null)
  const subs = useSubcategories(categoryId)
  const ops = useOperationTypes(categoryId, subcategoryId)
  const create = useCreateRequest()

  const selectedCat = cats.data?.find((c) => c.id === categoryId)
  const needsSub = selectedCat?.has_subcategories
  const canSubmit = first && last && categoryId && (!needsSub || subcategoryId) && files.length > 0

  const submit = async () => {
    const res = await create.mutateAsync({
      tenantId: appUser!.tenant_id, createdBy: appUser!.id,
      patient: { first_name: first, last_name: last },
      categoryId, subcategoryId: needsSub ? subcategoryId : null,
      operationTypeId, notes, files,
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
      <textarea className="w-full border rounded p-2" placeholder="Not" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <PhotoUploader files={files} onChange={setFiles} />
      {warn && <p className="text-amber-700 text-sm">{warn}</p>}
      <button disabled={!canSubmit || create.isPending}
        className="w-full bg-slate-800 text-white rounded p-2 disabled:opacity-40"
        onClick={submit}>{create.isPending ? 'Gönderiliyor…' : 'Gönder'}</button>
    </div>
  )
}
