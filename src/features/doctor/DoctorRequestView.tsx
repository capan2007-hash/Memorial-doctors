import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useRespond } from './useRespond'
import { useMyDoctorId } from './useMyDoctorId'
import { AiPanel } from '../ai/AiPanel'
import { PatientInfoCard } from '../requests/PatientInfoCard'
import { resolvePhotoUrls } from '../requests/photoUrl'
import { catalogName, type CatalogRef } from '../catalog/catalogName'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill } from '../../components/ui/StatusPill'
import { Check, X } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { PhotoGrid } from '../../components/ui/PhotoGrid'
import { Field } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Textarea } from '@/components/shadcn/textarea'
import { Skeleton } from '@/components/shadcn/skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { timeAgo } from '../../lib/format'
import type { RequestRow, PhotoRow } from '../../types/db'

export function DoctorRequestView() {
  const { t, i18n } = useTranslation('doctors')
  const { id } = useParams()
  const { appUser } = useAuth()
  const respond = useRespond()
  const toast = useToast()
  const myDoctorId = useMyDoctorId()
  const [mode, setMode] = useState<'none' | 'accept' | 'reject'>('none')
  const [plan, setPlan] = useState('')
  const [reason, setReason] = useState('')
  const [respErr, setRespErr] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['doctor-request', id], enabled: !!id, queryFn: async () => {
    const { data: reqData } = await supabase.from('request').select('*').eq('id', id!).single()
    const req = reqData as RequestRow
    const [{ data: patient }, { data: category }, { data: subcategory }, { data: operationType }, { data: photoRows }] = await Promise.all([
      supabase.from('patient').select('first_name, last_name').eq('id', req.patient_id).single(),
      supabase.from('category').select('name, name_i18n').eq('id', req.category_id).single(),
      req.subcategory_id
        ? supabase.from('subcategory').select('name, name_i18n').eq('id', req.subcategory_id).single()
        : Promise.resolve({ data: null }),
      req.operation_type_id
        ? supabase.from('operation_type').select('name, name_i18n').eq('id', req.operation_type_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('photo').select('*').eq('request_id', id!),
    ])
    const allPhotos = (photoRows ?? []) as PhotoRow[]
    const [photos, xrays] = await Promise.all([
      resolvePhotoUrls(allPhotos.filter((p) => p.kind === 'photo' && !p.deleted_at)),
      resolvePhotoUrls(allPhotos.filter((p) => p.kind === 'xray' && !p.deleted_at)),
    ])
    return {
      req,
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
      category: (category as CatalogRef | null) ?? undefined,
      subcategory: (subcategory as CatalogRef | null) ?? null,
      operationType: (operationType as CatalogRef | null) ?? null,
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
        sourceLang: i18n.language,
      })
      setRespErr(null)
      setMode('none')
      toast.show(t('requestView.responseSaved'))
    } catch (e) {
      const message = t('requestView.responseSaveFailed', { message: (e as Error).message })
      setRespErr(message)
      toast.show(message, 'error')
    }
  }

  if (q.isError || (!q.isLoading && !q.data)) {
    return <EmptyState title={t('requestView.notFoundTitle')} description={t('requestView.notFoundDescription')} />
  }

  if (!q.data) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-40" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface-2 p-4 shadow-card md:p-5">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const { req, patientName, category, subcategory, operationType, photos, xrays } = q.data
  const categoryName = category ? catalogName(category, i18n.language) : undefined
  const subcategoryName = subcategory ? catalogName(subcategory, i18n.language) : null
  const operationName = operationType ? catalogName(operationType, i18n.language) : null
  const title = `${patientName} — ${operationName ?? subcategoryName ?? categoryName}`

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <PageHeader
        title={title}
        subtitle={t('requestView.subtitle', { id: req.id.slice(0, 8), time: timeAgo(req.created_at) })}
        actions={<StatusPill status={req.status} />}
      />
      <PatientInfoCard
        req={req}
        patientName={patientName}
        categoryName={categoryName}
        subcategoryName={subcategoryName}
        operationName={operationName}
      />
      <Card title={t('requestView.photosCardTitle')}>
        <PhotoGrid urls={photos} title={t('requestView.photoGridTitle')} />
      </Card>
      {xrays.length > 0 && (
        <Card title={t('requestView.xraysCardTitle')}>
          <PhotoGrid urls={xrays} title={t('requestView.xrayGridTitle')} />
        </Card>
      )}
      <AiPanel requestId={req.id} canGiveFeedback doctorId={myDoctorId.data} />
      <div className="sticky bottom-16 md:bottom-0">
        <div className="bg-surface-1/95 border-t border-line backdrop-blur p-4 md:rounded-card md:border md:shadow-card">
          {respErr && <p className="text-danger-text text-sm mb-2">{respErr}</p>}
          {mode === 'none' && (
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1 min-h-[44px]" onClick={() => setMode('accept')}>
                <Icon of={Check} size={16} />
                {t('requestView.acceptButton')}
              </Button>
              <Button variant="danger" className="flex-1 min-h-[44px]" onClick={() => setMode('reject')}>
                <Icon of={X} size={16} />
                {t('requestView.rejectButton')}
              </Button>
            </div>
          )}
          {mode === 'accept' && (
            <div className="space-y-3">
              <Field label={t('requestView.treatmentPlanLabel')}>
                <Textarea
                  placeholder={t('requestView.treatmentPlanLabel')}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                />
              </Field>
              <Button
                variant="primary"
                className="w-full min-h-[44px]"
                disabled={!plan}
                loading={respond.isPending}
                onClick={doRespond}
              >
                <Icon of={Check} size={16} />
                {t('requestView.acceptSubmit')}
              </Button>
            </div>
          )}
          {mode === 'reject' && (
            <div className="space-y-3">
              <Field label={t('requestView.rejectReasonLabel')}>
                <Textarea
                  placeholder={t('requestView.rejectReasonPlaceholder')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <Button
                variant="danger"
                className="w-full min-h-[44px]"
                disabled={!reason}
                loading={respond.isPending}
                onClick={doRespond}
              >
                <Icon of={X} size={16} />
                {t('requestView.rejectSubmit')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
