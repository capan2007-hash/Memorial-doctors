import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useBilling, useSetInfraCost, type BillingCompany, type BillingService } from './useBilling'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { Input } from '@/components/shadcn/input'
import { Skeleton } from '@/components/shadcn/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shadcn/table'

/** Küçük tutarlarda 4 hane, >= 0.01 için 2 hane; USD ön ekiyle. */
function fmtUsd(v: number): string {
  return '$' + (v >= 0.01 ? v.toFixed(2) : v.toFixed(4))
}

function ServiceRow({ s }: { s: BillingService }) {
  const { t } = useTranslation('admin')
  return (
    <TableRow>
      <TableCell className="text-ink-secondary">{t(`billing.services.${s.service}`, { defaultValue: s.service })}</TableCell>
      <TableCell className="tnum text-right text-ink-primary">{fmtUsd(s.cost)}</TableCell>
      <TableCell className="tnum text-right text-ink-muted">{s.calls}</TableCell>
      <TableCell className="tnum text-right text-ink-muted">{s.inTok} / {s.outTok}</TableCell>
    </TableRow>
  )
}

function CompanyCard({ c }: { c: BillingCompany }) {
  const { t } = useTranslation('admin')
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 pb-2">
        <h3 className="font-display text-base text-ink-primary">{c.name}</h3>
        <div className="rounded-control bg-brand-fill/10 px-3 py-1 text-right">
          <p className="text-[11px] text-brand-text">{t('billing.weeklyChargeLabel')}</p>
          <p className="font-display text-lg tnum text-brand-text">{fmtUsd(c.weeklyCharge)}</p>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('billing.columns.service')}</TableHead>
            <TableHead className="text-right">{t('billing.columns.cost')}</TableHead>
            <TableHead className="text-right">{t('billing.columns.calls')}</TableHead>
            <TableHead className="text-right">{t('billing.columns.tokens')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {c.services.map((s) => <ServiceRow key={s.service} s={s} />)}
          {/* Altyapı (tahmini): AI-çağrı payına göre dağıtılan Supabase/Cloudflare maliyeti. */}
          <TableRow>
            <TableCell className="text-ink-secondary">
              {t('billing.infraRowLabel')} <span className="text-ink-muted">{t('billing.infraEstimated')}</span>
            </TableCell>
            <TableCell className="tnum text-right text-ink-primary">{fmtUsd(c.infraCost)}</TableCell>
            <TableCell className="tnum text-right text-ink-muted">—</TableCell>
            <TableCell className="tnum text-right text-ink-muted">—</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div className="mt-3 flex justify-end gap-4 border-t border-line pt-2 text-sm">
        <span className="text-ink-muted">{t('billing.aiLabel')} <span className="tnum text-ink-secondary">{fmtUsd(c.aiCost)}</span></span>
        <span className="text-ink-muted">{t('billing.infraLabel')} <span className="tnum text-ink-secondary">{fmtUsd(c.infraCost)}</span></span>
        <span className="text-ink-secondary">{t('billing.totalLabel')}&nbsp;<span className="font-medium tnum text-ink-primary">{fmtUsd(c.totalCost)}</span></span>
      </div>
    </Card>
  )
}

function InfraEditor({ current }: { current: number }) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const setInfra = useSetInfraCost()
  const [val, setVal] = useState(String(current))
  useEffect(() => { setVal(String(current)) }, [current])

  const save = async () => {
    const n = Number(val)
    if (!(n >= 0)) { toast.show(t('billing.infraEditor.invalidAmount'), 'error'); return }
    try {
      await setInfra.mutateAsync(n)
      toast.show(t('billing.infraEditor.updatedToast'))
    } catch (e) {
      toast.show(t('billing.infraEditor.updateFailedToast', { message: (e as Error).message }), 'error')
    }
  }

  return (
    <Card title={t('billing.infraEditor.cardTitle')}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('billing.infraEditor.fieldLabel')}>
          <Input className="w-40" type="number" min={0} step="0.01"
            value={val} onChange={(e) => setVal(e.target.value)} placeholder={t('billing.infraEditor.placeholder')} />
        </Field>
        <Button variant="primary" type="button" loading={setInfra.isPending} onClick={save}>{t('billing.infraEditor.saveButton')}</Button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        <Trans i18nKey="billing.infraEditor.note" t={t}>
          Supabase/Cloudflare gibi sabit platform maliyeti. Firmalara <span className="font-medium">AI-çağrı payına göre</span> dağıtılır (tahmini);
          haftalık gösterimde 7/30 oranıyla hesaplanır.
        </Trans>
      </p>
    </Card>
  )
}

export function Billing() {
  const { t } = useTranslation('admin')
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const billing = useBilling(period)
  const data = billing.data

  const isEmpty = !!data && data.companies.filter((c) => c.totalCost > 0).length === 0

  return (
    <div className="space-y-4">
      <PageHeader title={t('billing.title')} subtitle={t('billing.subtitle')} />

      <Tabs value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month')} className="block">
        <TabsList>
          <TabsTrigger value="week">{t('billing.periodTabs.week')}</TabsTrigger>
          <TabsTrigger value="month">{t('billing.periodTabs.month')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {billing.isLoading && (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-9 w-32" /></div>
              <div className="space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-9 w-32" /></div>
            </div>
          </Card>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-card border border-line bg-surface-2 p-4 shadow-card md:p-5">
              <Skeleton className="mb-4 h-5 w-40" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {billing.isError && (
        <div className="rounded-control border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">
          {t('billing.loadError', { message: (billing.error as Error).message })}
        </div>
      )}

      {!billing.isLoading && !billing.isError && data && (
        <>
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink-muted">{t('billing.totalCostLabel')}</p>
                <p className="font-display text-3xl tnum text-ink-primary">{fmtUsd(data.grandTotalCost)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{t('billing.weeklyChargeLabel')}</p>
                <p className="font-display text-3xl tnum text-brand-text">{fmtUsd(data.grandTotalCharge)}</p>
                <p className="text-xs text-ink-muted">{t('billing.weeklyChargeSublabel')}</p>
              </div>
            </div>
          </Card>

          <InfraEditor current={data.infraMonthlyUsd} />

          {isEmpty ? (
            <EmptyState title={t('billing.emptyTitle')} description={t('billing.emptyDescription')} />
          ) : (
            <div className="space-y-3">
              {data.companies.filter((c) => c.totalCost > 0).map((c) => <CompanyCard key={c.tenantId} c={c} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
