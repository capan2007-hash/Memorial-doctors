import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusPill } from '../../components/ui/StatusPill'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useEligibleDoctors } from '../requests/useEligibleDoctors'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { Skeleton } from '@/components/shadcn/skeleton'
import { timeAgo } from '../../lib/format'
import { slaInfo } from '../../domain/sla'
import type { RequestRow } from '../../types/db'
import { AiAccuracyCard } from '../ai/AiAccuracyCard'
import { Icon } from '../../components/ui/Icon'
import { AlertTriangle, Clock } from 'lucide-react'
import { catalogName, type CatalogRef } from '../catalog/catalogName'

type EnrichedRequestRow = RequestRow & { patientName: string; category?: CatalogRef; hasAccept: boolean }

const COMPLETED_STATUSES = new Set<RequestRow['status']>(['offers_ready', 'closed'])

type SlaTab = 'all' | 'pending' | 'overdue' | 'completed'

/** Talebin gecikme panosu sınıflandırması (FR-26/29): tamamlanan durum/kabul öncelikli;
 * kalanlar SLA saatine göre geciken/bekleyen. slaInfo hasResponse=false verilir çünkü
 * bekleyen/geciken sınıflandırması "yanıt bekliyor mu" sorusuyla ilgilenir (tekil kabul
 * bir talebi zaten tamamlanmış yapar ve bu dala hiç girmez). */
function classify(
  r: EnrichedRequestRow,
  slaHours: number,
  reminderHours: number,
  now: Date,
): { tab: Exclude<SlaTab, 'all'>; info: ReturnType<typeof slaInfo> | null } {
  if (COMPLETED_STATUSES.has(r.status) || r.hasAccept) return { tab: 'completed', info: null }
  const info = slaInfo(r.assigned_at, slaHours, reminderHours, false, now)
  return { tab: info.state === 'overdue' ? 'overdue' : 'pending', info }
}

export function AllRequests() {
  const { t, i18n } = useTranslation('admin')
  const TAB_LABEL: Record<SlaTab, string> = {
    all: t('allRequests.tabs.all'),
    pending: t('allRequests.tabs.pending'),
    overdue: t('allRequests.tabs.overdue'),
    completed: t('allRequests.tabs.completed'),
  }
  const { appUser } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<SlaTab>('all')
  const reqs = useQuery({ queryKey: ['all-requests'], queryFn: async (): Promise<EnrichedRequestRow[]> => {
    const { data } = await supabase.from('request').select('*').order('created_at', { ascending: false })
    const requests = (data ?? []) as RequestRow[]
    const [{ data: patients }, { data: categories }, { data: acceptResponses }] = await Promise.all([
      supabase.from('patient').select('id, first_name, last_name'),
      supabase.from('category').select('id, name, name_i18n'),
      supabase.from('response').select('request_id').eq('decision', 'accept'),
    ])
    const patientMap = new Map((patients ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]))
    const categoryMap = new Map((categories ?? []).map((c: any) => [c.id, c as CatalogRef]))
    const acceptedRequestIds = new Set((acceptResponses ?? []).map((r: any) => r.request_id as string))
    return requests.map((r) => ({
      ...r,
      patientName: patientMap.get(r.patient_id) ?? '—',
      category: categoryMap.get(r.category_id),
      hasAccept: acceptedRequestIds.has(r.id),
    }))
  }})
  const tenantSla = useQuery({
    queryKey: ['tenant-sla', appUser?.tenant_id],
    enabled: !!appUser?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase.from('tenant').select('sla_hours, sla_reminder_hours').single()
      if (error) throw error
      return data as { sla_hours: number; sla_reminder_hours: number }
    },
  })
  const slaHours = tenantSla.data?.sla_hours ?? 24
  const reminderHours = tenantSla.data?.sla_reminder_hours ?? 4

  const classified = useMemo(() => {
    const now = new Date()
    return (reqs.data ?? []).map((r) => ({ row: r, ...classify(r, slaHours, reminderHours, now) }))
  }, [reqs.data, slaHours, reminderHours])

  const counts = useMemo(() => ({
    all: classified.length,
    pending: classified.filter((c) => c.tab === 'pending').length,
    overdue: classified.filter((c) => c.tab === 'overdue').length,
    completed: classified.filter((c) => c.tab === 'completed').length,
  }), [classified])

  const visible = tab === 'all' ? classified : classified.filter((c) => c.tab === tab)
  // Yeniden atamada doktor seçimi: hangi talebin paneli açık + o talep için seçilenler
  const [pickerFor, setPickerFor] = useState<RequestRow | null>(null)
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const pickerEligible = useEligibleDoctors(pickerFor?.category_id, pickerFor?.subcategory_id ?? null)
  const reassign = useMutation({
    // Manuel: talebin kategorisindeki (alt kırılıma göre daraltılmış) doktorları yeniden ata (audit'li)
    mutationFn: async ({ req, doctorIds }: { req: RequestRow; doctorIds?: string[] | null }) => {
      if (req.status === 'closed') {
        throw new Error(t('allRequests.reassignClosedError'))
      }
      // Atama + durum + audit sunucu tarafında (migration 0024/0055 RPC'si);
      // 0 uygun doktor dönerse durum/audit değişmez, kullanıcı bilgilendirilir.
      // doctorIds null → tüm uygun doktorlar; dizi → yalnız seçilenler (sunucu scope'u yine uygular).
      const { data: count, error } = await supabase.rpc('assign_request_doctors', {
        p_request_id: req.id,
        p_type: 'manual',
        p_doctor_ids: doctorIds ?? null,
      })
      if (error) throw error
      return { assigned: ((count as number) ?? 0) > 0 }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['all-requests'] })
      if (result.assigned) {
        toast.show(t('allRequests.reassignSuccess'))
      } else {
        toast.show(t('allRequests.reassignNoDoctors'), 'error')
      }
    },
    onError: (e) => {
      toast.show((e as Error).message || t('allRequests.reassignFailed'), 'error')
    },
  })
  return (
    <div>
      <PageHeader title={t('allRequests.title')} />
      <AiAccuracyCard />
      <Tabs value={tab} onValueChange={(v) => setTab(v as SlaTab)} className="mt-3 block">
        <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
          {(['all', 'pending', 'overdue', 'completed'] as SlaTab[]).map((slaTab) => (
            <TabsTrigger key={slaTab} value={slaTab} className="gap-1.5 py-1.5">
              {TAB_LABEL[slaTab]}
              <span
                className={`tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  tab === slaTab ? 'bg-brand-fill/12 text-brand-text' : 'bg-muted-foreground/15 text-muted-foreground'
                }`}
              >
                {counts[slaTab]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {reqs.isLoading && (
        <ul className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface-2 p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </li>
          ))}
        </ul>
      )}
      {!reqs.isLoading && reqs.data?.length === 0 && <EmptyState title={t('allRequests.emptyTitle')} />}
      {!reqs.isLoading && reqs.data && reqs.data.length > 0 && visible.length === 0 && (
        <EmptyState title={t('allRequests.emptyFilterTitle')} />
      )}
      {!reqs.isLoading && visible.length > 0 && (
        <ul className="mt-3 space-y-2">
          {visible.map(({ row: r, tab: rowTab, info }) => {
            const isClosed = r.status === 'closed'
            return (
              <li key={r.id} className="flex items-center gap-2">
                <Link
                  to={`/requests/${r.id}`}
                  className={`flex flex-1 min-w-0 items-center gap-3 rounded-card bg-surface-2 border border-line p-3 transition ease-premium duration-[var(--dur-fast)] hover:shadow-pop hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40 ${
                    rowTab === 'overdue' ? 'border-s-4 border-s-danger-border' : ''
                  }`}
                >
                  <Avatar name={r.patientName} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-primary hover:text-brand-text truncate">{r.patientName}</p>
                    <p className="text-sm text-ink-muted truncate">{r.category ? catalogName(r.category, i18n.language) : '—'} · {timeAgo(r.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === 'submitted' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning-bg text-warning-text">{t('allRequests.notAssignedBadge')}</span>
                    )}
                    {info && rowTab === 'overdue' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-danger-bg text-danger-text font-medium">
                        <Icon of={AlertTriangle} size={13} />
                        <span className="tnum">{t('allRequests.sla.overdue', { count: info.hoursOver })}</span>
                      </span>
                    )}
                    {info && rowTab === 'pending' && info.state === 'warning' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning-bg text-warning-text font-medium">
                        <Icon of={Clock} size={13} />
                        <span className="tnum">{t('allRequests.sla.remaining', { count: info.hoursLeft })}</span>
                      </span>
                    )}
                    <StatusPill status={r.status} />
                  </div>
                </Link>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={isClosed}
                    title={isClosed ? t('allRequests.reassignClosedError') : undefined}
                    onClick={() => reassign.mutate({ req: r, doctorIds: null })}
                  >
                    {t('allRequests.reassignButton')}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={isClosed}
                    onClick={() => {
                      setPickedIds([])
                      setPickerFor(pickerFor?.id === r.id ? null : r)
                    }}
                  >
                    {t('allRequests.reassignPick')}
                  </Button>
                </div>
                {pickerFor?.id === r.id && (
                  <div className="mt-2 space-y-2 rounded-card border border-line bg-surface-1 p-3">
                    {pickerEligible.isLoading ? (
                      <p className="text-sm text-ink-muted">{t('allRequests.reassignLoading')}</p>
                    ) : (pickerEligible.data?.length ?? 0) === 0 ? (
                      <p className="text-sm text-warning-text">{t('allRequests.reassignNoEligible')}</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {pickerEligible.data!.map((d) => {
                            const on = pickedIds.includes(d.id)
                            return (
                              <button
                                key={d.id}
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                  setPickedIds((prev) =>
                                    prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                                  )
                                }
                                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                                  on
                                    ? 'border-brand-fill bg-brand-fill text-white'
                                    : 'border-line bg-surface-2 text-ink-secondary hover:border-line-strong'
                                }`}
                              >
                                {d.name}
                              </button>
                            )
                          })}
                        </div>
                        <Button
                          variant="primary"
                          disabled={pickedIds.length === 0}
                          onClick={() => {
                            reassign.mutate({ req: r, doctorIds: pickedIds })
                            setPickerFor(null)
                          }}
                        >
                          {t('allRequests.reassignSelected', { count: pickedIds.length })}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
