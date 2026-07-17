import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useCategories } from '../catalog/useCatalog'
import type { DoctorRow } from '../../types/db'

export function DoctorAdmin() {
  const { appUser } = useAuth()
  const qc = useQueryClient()
  const cats = useCategories()
  const [name, setName] = useState(''); const [categoryId, setCategoryId] = useState('')
  const docs = useQuery({ queryKey: ['doctors'], queryFn: async () => {
    const { data } = await supabase.from('doctor').select('*').order('title')
    return data as DoctorRow[]
  }})
  const addDoctor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('doctor').insert({
        tenant_id: appUser!.tenant_id, title: name, category_id: categoryId, is_active: true,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doctors'] }); setName(''); setCategoryId('') },
  })
  const toggle = useMutation({
    mutationFn: async (d: DoctorRow) => { await supabase.from('doctor').update({ is_active: !d.is_active }).eq('id', d.id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Doktor Yönetimi</h2>
      <div className="flex gap-2">
        <input className="border rounded p-2 flex-1" placeholder="Doktor adı" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="border rounded p-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Kategori…</option>
          {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button disabled={!name || !categoryId} className="bg-slate-800 text-white rounded px-3 disabled:opacity-40" onClick={() => addDoctor.mutate()}>Ekle</button>
      </div>
      <ul className="space-y-2">
        {docs.data?.map((d) => (
          <li key={d.id} className="border rounded p-3 bg-white flex justify-between">
            <span>{d.title} · skor {d.score} {d.is_active ? '' : '(pasif)'}</span>
            <button className="underline text-sm" onClick={() => toggle.mutate(d)}>{d.is_active ? 'Pasifleştir' : 'Aktifleştir'}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
