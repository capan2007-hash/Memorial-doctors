import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useRespond } from './useRespond'
import { PatientInfoCard } from '../requests/PatientInfoCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill } from '../../components/ui/StatusPill'
import { Card } from '../../components/ui/Card'
import { PhotoGrid } from '../../components/ui/PhotoGrid'
import { Field } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { timeAgo } from '../../lib/format'
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
  const toast = useToast()
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
      toast.show('Yanıtınız kaydedildi')
    } catch (e) {
      const message = 'Yanıt kaydedilemedi: ' + (e as Error).message
      setRespErr(message)
      toast.show(message, 'error')
    }
  }

  if (!q.data) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  const { req, patientName, categoryName, subcategoryName, operationName, photos, xrays } = q.data
  const title = `${patientName} — ${operationName ?? subcategoryName ?? categoryName}`

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <PageHeader
        title={title}
        subtitle={`Talep #${req.id.slice(0, 8)} · ${timeAgo(req.created_at)}`}
        actions={<StatusPill status={req.status} />}
      />
      <PatientInfoCard
        req={req}
        patientName={patientName}
        categoryName={categoryName}
        subcategoryName={subcategoryName}
        operationName={operationName}
      />
      <Card title="Fotoğraflar">
        <PhotoGrid urls={photos} title="Fotoğraf" />
      </Card>
      {xrays.length > 0 && (
        <Card title="Diş Röntgeni">
          <PhotoGrid urls={xrays} title="Röntgen" />
        </Card>
      )}
      {/* AI uyarıları — M2 */}
      <div className="sticky bottom-16 md:bottom-0">
        <Card>
          {respErr && <p className="text-red-600 text-sm mb-2">{respErr}</p>}
          {mode === 'none' && (
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setMode('accept')}>Kabul</Button>
              <Button variant="danger" className="flex-1" onClick={() => setMode('reject')}>Red</Button>
            </div>
          )}
          {mode === 'accept' && (
            <div className="space-y-3">
              <Field label="Tedavi planı">
                <textarea
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="Tedavi planı"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                />
              </Field>
              <Button
                variant="primary"
                className="w-full"
                disabled={!plan}
                loading={respond.isPending}
                onClick={doRespond}
              >
                Kabul et
              </Button>
            </div>
          )}
          {mode === 'reject' && (
            <div className="space-y-3">
              <Field label="Red gerekçesi">
                <textarea
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="Red gerekçesi (zorunlu)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <Button
                variant="danger"
                className="w-full"
                disabled={!reason}
                loading={respond.isPending}
                onClick={doRespond}
              >
                Reddet
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
