import { useEffect, useState } from 'react'
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

const SERVICE_LABELS: Record<string, string> = { triage: 'AI Triyaj', vision: 'AI Görsel' }
function serviceLabel(service: string): string { return SERVICE_LABELS[service] ?? service }

function ServiceRow({ s }: { s: BillingService }) {
  return (
    <TableRow>
      <TableCell className="text-ink-secondary">{serviceLabel(s.service)}</TableCell>
      <TableCell className="tnum text-right text-ink-primary">{fmtUsd(s.cost)}</TableCell>
      <TableCell className="tnum text-right text-ink-muted">{s.calls}</TableCell>
      <TableCell className="tnum text-right text-ink-muted">{s.inTok} / {s.outTok}</TableCell>
    </TableRow>
  )
}

function CompanyCard({ c }: { c: BillingCompany }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 pb-2">
        <h3 className="font-display text-base text-ink-primary">{c.name}</h3>
        <div className="rounded-control bg-brand-fill/10 px-3 py-1 text-right">
          <p className="text-[11px] text-brand-text">Haftalık tahsilat (2×)</p>
          <p className="font-display text-lg tnum text-brand-text">{fmtUsd(c.weeklyCharge)}</p>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Servis</TableHead>
            <TableHead className="text-right">Maliyet</TableHead>
            <TableHead className="text-right">Çağrı</TableHead>
            <TableHead className="text-right">Token (in / out)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {c.services.map((s) => <ServiceRow key={s.service} s={s} />)}
          {/* Altyapı (tahmini): AI-çağrı payına göre dağıtılan Supabase/Cloudflare maliyeti. */}
          <TableRow>
            <TableCell className="text-ink-secondary">
              Altyapı <span className="text-ink-muted">(tahmini)</span>
            </TableCell>
            <TableCell className="tnum text-right text-ink-primary">{fmtUsd(c.infraCost)}</TableCell>
            <TableCell className="tnum text-right text-ink-muted">—</TableCell>
            <TableCell className="tnum text-right text-ink-muted">—</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div className="mt-3 flex justify-end gap-4 border-t border-line pt-2 text-sm">
        <span className="text-ink-muted">AI: <span className="tnum text-ink-secondary">{fmtUsd(c.aiCost)}</span></span>
        <span className="text-ink-muted">Altyapı: <span className="tnum text-ink-secondary">{fmtUsd(c.infraCost)}</span></span>
        <span className="text-ink-secondary">Toplam:&nbsp;<span className="font-medium tnum text-ink-primary">{fmtUsd(c.totalCost)}</span></span>
      </div>
    </Card>
  )
}

function InfraEditor({ current }: { current: number }) {
  const toast = useToast()
  const setInfra = useSetInfraCost()
  const [val, setVal] = useState(String(current))
  useEffect(() => { setVal(String(current)) }, [current])

  const save = async () => {
    const n = Number(val)
    if (!(n >= 0)) { toast.show('Geçerli bir tutar girin', 'error'); return }
    try {
      await setInfra.mutateAsync(n)
      toast.show('Altyapı maliyeti güncellendi')
    } catch (e) {
      toast.show('Güncellenemedi: ' + (e as Error).message, 'error')
    }
  }

  return (
    <Card title="Altyapı maliyeti (aylık)">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Aylık altyapı maliyeti (USD)">
          <Input className="w-40" type="number" min={0} step="0.01"
            value={val} onChange={(e) => setVal(e.target.value)} placeholder="ör. 30" />
        </Field>
        <Button variant="primary" type="button" loading={setInfra.isPending} onClick={save}>Kaydet</Button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Supabase/Cloudflare gibi sabit platform maliyeti. Firmalara <span className="font-medium">AI-çağrı payına göre</span> dağıtılır (tahmini);
        haftalık gösterimde 7/30 oranıyla hesaplanır.
      </p>
    </Card>
  )
}

export function Billing() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const billing = useBilling(period)
  const data = billing.data

  const isEmpty = !!data && data.companies.filter((c) => c.totalCost > 0).length === 0

  return (
    <div className="space-y-4">
      <PageHeader title="Billing" subtitle="Firma bazlı AI + altyapı maliyeti ve haftalık tahsilat (USD)." />

      <Tabs value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month')} className="block">
        <TabsList>
          <TabsTrigger value="week">Bu hafta</TabsTrigger>
          <TabsTrigger value="month">Bu ay</TabsTrigger>
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
          Billing verisi alınamadı: {(billing.error as Error).message}
        </div>
      )}

      {!billing.isLoading && !billing.isError && data && (
        <>
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink-muted">Toplam maliyet (AI + altyapı)</p>
                <p className="font-display text-3xl tnum text-ink-primary">{fmtUsd(data.grandTotalCost)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Haftalık tahsilat (2×)</p>
                <p className="font-display text-3xl tnum text-brand-text">{fmtUsd(data.grandTotalCharge)}</p>
                <p className="text-xs text-ink-muted">2× reseller markup</p>
              </div>
            </div>
          </Card>

          <InfraEditor current={data.infraMonthlyUsd} />

          {isEmpty ? (
            <EmptyState title="Bu dönemde maliyet yok" description="Seçili dönemde firma bazlı AI/altyapı maliyeti oluşmadı." />
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
