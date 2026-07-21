import { useState } from 'react'
import { useBilling, type BillingCompany, type BillingService } from './useBilling'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'

/** Küçük tutarlarda 4 hane, >= 0.01 için 2 hane; USD ön ekiyle. */
function fmtUsd(v: number): string {
  return '$' + (v >= 0.01 ? v.toFixed(2) : v.toFixed(4))
}

const SERVICE_LABELS: Record<string, string> = { triage: 'AI Triyaj', vision: 'AI Görsel' }
function serviceLabel(service: string): string { return SERVICE_LABELS[service] ?? service }

function ServiceRow({ s }: { s: BillingService }) {
  return (
    <tr className="border-t border-line">
      <td className="py-1.5 pr-3 text-ink-secondary">{serviceLabel(s.service)}</td>
      <td className="py-1.5 pr-3 text-right tnum text-ink-primary">{fmtUsd(s.cost)}</td>
      <td className="py-1.5 pr-3 text-right tnum text-ink-muted">{s.calls}</td>
      <td className="py-1.5 text-right tnum text-ink-muted">{s.inTok} / {s.outTok}</td>
    </tr>
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
      {c.services.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-muted">
              <th className="py-1 pr-3 text-left font-medium">Servis</th>
              <th className="py-1 pr-3 text-right font-medium">Maliyet</th>
              <th className="py-1 pr-3 text-right font-medium">Çağrı</th>
              <th className="py-1 text-right font-medium">Token (in / out)</th>
            </tr>
          </thead>
          <tbody>
            {c.services.map((s) => <ServiceRow key={s.service} s={s} />)}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-muted">Bu dönemde kullanım yok.</p>
      )}
      <div className="mt-3 flex justify-end border-t border-line pt-2 text-sm">
        <span className="text-ink-secondary">Toplam AI maliyeti:&nbsp;</span>
        <span className="font-medium tnum text-ink-primary">{fmtUsd(c.totalCost)}</span>
      </div>
    </Card>
  )
}

export function Billing() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const billing = useBilling(period)
  const data = billing.data

  const isEmpty = !!data && (data.companies.length === 0 || data.grandTotalCost === 0)

  return (
    <div className="space-y-4">
      <PageHeader title="Billing" subtitle="Firma bazlı AI kullanım maliyeti ve haftalık tahsilat (USD)." />

      <div className="flex gap-2">
        <Button variant={period === 'week' ? 'primary' : 'secondary'} type="button" onClick={() => setPeriod('week')}>
          Bu hafta
        </Button>
        <Button variant={period === 'month' ? 'primary' : 'secondary'} type="button" onClick={() => setPeriod('month')}>
          Bu ay
        </Button>
      </div>

      {billing.isLoading && (
        <div className="flex justify-center py-10"><Spinner /></div>
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
                <p className="text-xs text-ink-muted">Toplam AI maliyeti</p>
                <p className="font-display text-3xl tnum text-ink-primary">{fmtUsd(data.grandTotalCost)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Haftalık tahsilat (2×)</p>
                <p className="font-display text-3xl tnum text-brand-text">{fmtUsd(data.grandTotalCharge)}</p>
                <p className="text-xs text-ink-muted">2× reseller markup</p>
              </div>
            </div>
          </Card>

          {isEmpty ? (
            <EmptyState title="Bu dönemde AI kullanımı yok" description="Seçili dönemde firma bazlı AI maliyeti oluşmadı." />
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
