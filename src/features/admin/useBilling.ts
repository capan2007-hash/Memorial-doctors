import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface BillingService { service: string; cost: number; calls: number; inTok: number; outTok: number }
export interface BillingCompany {
  tenantId: string; name: string; services: BillingService[]
  aiCost: number; infraCost: number; calls: number
  totalCost: number; weeklyCharge: number
}
export interface BillingData {
  period: 'week' | 'month'; periodStart: string; currency: string
  infraMonthlyUsd: number
  companies: BillingCompany[]; grandTotalCost: number; grandTotalCharge: number
}

async function invokeBilling(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('billing-admin', { body })
  if (error) {
    let msg = error.message
    try { const ctx = (error as unknown as { context?: Response }).context; if (ctx?.json) { const j = await ctx.json(); if (j?.error) msg = j.error } } catch { /* */ }
    throw new Error(msg)
  }
  return data
}

export function useBilling(period: 'week' | 'month') {
  return useQuery({
    queryKey: ['billing', period],
    queryFn: () => invokeBilling({ period }) as Promise<BillingData>,
  })
}

/** super_admin aylık altyapı maliyetini günceller (billing yeniden hesaplanır). */
export function useSetInfraCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (infraMonthlyUsd: number) => invokeBilling({ action: 'set_infra', infraMonthlyUsd }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  })
}
