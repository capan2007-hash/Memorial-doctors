import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface BillingService { service: string; cost: number; calls: number; inTok: number; outTok: number }
export interface BillingCompany { tenantId: string; name: string; services: BillingService[]; totalCost: number; weeklyCharge: number }
export interface BillingData { period: 'week' | 'month'; periodStart: string; currency: string; companies: BillingCompany[]; grandTotalCost: number; grandTotalCharge: number }

export function useBilling(period: 'week' | 'month') {
  return useQuery({
    queryKey: ['billing', period],
    queryFn: async (): Promise<BillingData> => {
      const { data, error } = await supabase.functions.invoke('billing-admin', { body: { period } })
      if (error) {
        let msg = error.message
        try { const ctx = (error as unknown as { context?: Response }).context; if (ctx?.json) { const j = await ctx.json(); if (j?.error) msg = j.error } } catch { /* */ }
        throw new Error(msg)
      }
      return data as BillingData
    },
  })
}
