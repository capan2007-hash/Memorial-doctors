import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useRespond } from './useRespond'
import { PatientInfoCard } from '../requests/PatientInfoCard'
import type { RequestRow, PhotoRow } from '../../types/db'

async function signPhotoUrls(photos: PhotoRow[]) {
  const signed = await Promise.all(photos.map(async (p) => {
    const { data } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 300)
    return data?.signedUrl
  }))
  return signed.filter(Boolean) as string[]
}

export function DoctorRequestView() {
  const { id } = useParams()
  const { appUser } = useAuth()
  const respond = useRespond()
  const [mode, setMode] = useState<'none' | 'accept' | 'reject'>('none')
  const [plan, setPlan] = useState('')
  const [reason, setReason] = useState('')
  const [respErr, setRespErr] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['doctor-request', id], enabled: !!id, queryFn: async () => {
    const { data: reqData } = await supabase.from('request').select('*').eq('id', id!).single()
    const req = reqData as RequestRow
    const [{ data: patient }, { data: category }, { data: subcategory }, { data: operationType }, { data: photoRows }] = await Promise.all([
      supabase.from('patient').select('first_name, last_name').eq('id', req.patient_id).single(),
      supabase.from('category').select('name').eq('id', req.category_id).single(),
      req.subcategory_id
        ? supabase.from('subcategory').select('name').eq('id', req.subcategory_id).single()
        : Promise.resolve({ data: null }),
      req.operation_type_id
        ? supabase.from('operation_type').select('name').eq('id', req.operation_type_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('photo').select('*').eq('request_id', id!),
    ])
    const allPhotos = (photoRows ?? []) as PhotoRow[]
    const [photos, xrays] = await Promise.all([
      signPhotoUrls(allPhotos.filter((p) => p.kind === 'photo')),
      signPhotoUrls(allPhotos.filter((p) => p.kind === 'xray')),
    ])
    return {
      req,
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
      categoryName: category?.name as string | undefined,
      subcategoryName: (subcategory?.name as string | undefined) ?? null,
      operationName: (operationType?.name as string | undefined) ?? null,
      photos,
      xrays,
    }
  }})

  useEffect(() => {
    // seen_at yaz (görüldü)
    (async () => {
      const { data: doc } = await supabase.from('doctor').select('id').eq('app_user_id', appUser!.id).single()
      if (doc?.id && id) {
        await supabase.from('assignment').update({ seen_at: new Date().toISOString() })
          .eq('request_id', id).eq('doctor_id', doc.id).is('seen_at', null)
      }
    })()
  }, [id, appUser])

  const doRespond = async () => {
    const { data: doc } = await supabase.from('doctor').select('id, tenant_id').eq('app_user_id', appUser!.id).single()
    if (!doc) return
    try {
      await respond.mutateAsync({
        tenantId: doc.tenant_id, requestId: q.data!.req.id, doctorId: doc.id,
        decision: mode === 'accept' ? 'accept' : 'reject',
        treatmentPlan: mode === 'accept' ? plan : undefined,
        rejectReason: mode === 'reject' ? reason : undefined,
      })
      setRespErr(null)
      setMode('none')
    } catch (e) {
      setRespErr('Yanıt kaydedilemedi: ' + (e as Error).message)
    }
  }

  if (!q.data) return <p>Yükleniyor…</p>
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Talep #{q.data.req.id.slice(0, 8)}</h2>
      <PatientInfoCard
        req={q.data.req}
        patientName={q.data.patientName}
        categoryName={q.data.categoryName}
        subcategoryName={q.data.subcategoryName}
        operationName={q.data.operationName}
      />
      <section>
        <h3 className="font-medium">Fotoğraflar</h3>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {q.data.photos.map((url, i) => <img key={i} src={url} className="rounded border" />)}
        </div>
      </section>
      {q.data.xrays.length > 0 && (
        <section>
          <h3 className="font-medium">Diş Röntgeni</h3>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {q.data.xrays.map((url, i) => <img key={i} src={url} className="rounded border" />)}
          </div>
        </section>
      )}
      {respErr && <p className="text-red-600 text-sm">{respErr}</p>}
      {/* AI uyarıları — M2 */}
      {mode === 'none' && (
        <div className="flex gap-2">
          <button className="flex-1 bg-green-600 text-white rounded p-2" onClick={() => setMode('accept')}>Kabul</button>
          <button className="flex-1 bg-red-600 text-white rounded p-2" onClick={() => setMode('reject')}>Red</button>
        </div>
      )}
      {mode === 'accept' && (
        <div className="space-y-2">
          <textarea className="w-full border rounded p-2" placeholder="Tedavi planı" value={plan} onChange={(e) => setPlan(e.target.value)} />
          <button disabled={!plan || respond.isPending} className="w-full bg-green-600 text-white rounded p-2 disabled:opacity-40" onClick={doRespond}>Kabul et</button>
        </div>
      )}
      {mode === 'reject' && (
        <div className="space-y-2">
          <textarea className="w-full border rounded p-2" placeholder="Red gerekçesi (zorunlu)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button disabled={!reason || respond.isPending} className="w-full bg-red-600 text-white rounded p-2 disabled:opacity-40" onClick={doRespond}>Reddet</button>
        </div>
      )}
    </div>
  )
}
