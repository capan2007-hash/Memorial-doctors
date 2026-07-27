import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'

export type OfferCurrency = 'EUR' | 'USD'

export interface PriceOffer {
  id: string
  amount: number
  currency: OfferCurrency
  created_at: string
  doctorIds: string[]
}

/** Talebin fiyat teklifi geçmişi (en yeni önce). RLS: doktor/aracı GÖREMEZ. */
export function usePriceOffers(requestId?: string) {
  return useQuery({
    queryKey: ['price-offers', requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<PriceOffer[]> => {
      const { data: offers, error } = await supabase
        .from('price_offer')
        .select('id, amount, currency, created_at')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (offers ?? []) as { id: string; amount: number; currency: OfferCurrency; created_at: string }[]
      if (rows.length === 0) return []

      const { data: links } = await supabase
        .from('price_offer_doctor')
        .select('offer_id, doctor_id')
        .in('offer_id', rows.map((o) => o.id))
      const byOffer = new Map<string, string[]>()
      for (const l of (links ?? []) as { offer_id: string; doctor_id: string }[]) {
        byOffer.set(l.offer_id, [...(byOffer.get(l.offer_id) ?? []), l.doctor_id])
      }
      return rows.map((o) => ({ ...o, amount: Number(o.amount), doctorIds: byOffer.get(o.id) ?? [] }))
    },
  })
}

interface CreateOfferInput {
  requestId: string
  tenantId: string
  createdBy: string
  amount: number
  currency: OfferCurrency
  doctorIds: string[]
}

/**
 * Fiyat teklifi kaydı: teklif + doktor bağlantıları + talebin satış durumunu
 * `offer_sent`e taşır. Teklif geçmişi korunur (revizyonda yeni satır eklenir).
 */
export function useCreateOffer() {
  const qc = useQueryClient()
  const { show } = useToast()
  return useMutation({
    mutationFn: async (input: CreateOfferInput) => {
      const { data: offer, error } = await supabase
        .from('price_offer')
        .insert({
          request_id: input.requestId,
          tenant_id: input.tenantId,
          created_by: input.createdBy,
          amount: input.amount,
          currency: input.currency,
        })
        .select('id')
        .single()
      if (error) throw error

      if (input.doctorIds.length > 0) {
        const { error: linkErr } = await supabase
          .from('price_offer_doctor')
          .insert(input.doctorIds.map((doctor_id) => ({ offer_id: (offer as { id: string }).id, doctor_id })))
        if (linkErr) throw linkErr
      }

      // Satış durumu: teklif verildi (sale_marked_at damgası trigger'da).
      const { error: reqErr } = await supabase
        .from('request')
        .update({ sale_status: 'offer_sent' })
        .eq('id', input.requestId)
      if (reqErr) throw reqErr
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['price-offers', v.requestId] })
      qc.invalidateQueries({ queryKey: ['request', v.requestId] })
    },
    onError: () => show('Teklif kaydedilemedi', 'error'),
  })
}

/** Satışı kapat: ameliyat tarihi + sale_done (+ talebi kapat, fotoğrafları arşive al). */
export function useCompleteSale() {
  const qc = useQueryClient()
  const { show } = useToast()
  return useMutation({
    mutationFn: async ({ requestId, surgeryDate }: { requestId: string; surgeryDate: string }) => {
      const { error } = await supabase
        .from('request')
        .update({ sale_status: 'sale_done', status: 'closed', surgery_date: surgeryDate })
        .eq('id', requestId)
      if (error) throw error
      // Mevcut akışla aynı: satış kapanınca fotoğraflar arşive taşınır (fire-and-forget).
      void supabase.functions
        .invoke('photo-lifecycle', { body: { mode: 'archive', requestId } })
        .catch(() => {})
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['request', v.requestId] })
    },
    onError: () => show('Satış tamamlanamadı', 'error'),
  })
}
