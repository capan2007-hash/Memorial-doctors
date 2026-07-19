import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import type { SaleStatus } from '../../types/domain'

interface SetSaleStatusInput {
  requestId: string
  saleStatus: SaleStatus
  tenantId: string
  actorId: string
}

/**
 * Satış durumu işaretleme (BRD §7.8, FR-30b/31/34). `sale_marked_at` DB tetikleyicisi
 * tarafından otomatik güncellenir (bkz. migration 0016 `guard_sale_status`).
 * sale_done'da talep kapanır ve fotoğrafların arşive taşınması `photo-lifecycle`
 * fonksiyonuna fire-and-forget devredilir (taşıma cron beklemeden anında başlasın).
 */
export function useSetSaleStatus() {
  const qc = useQueryClient()
  const { show } = useToast()
  return useMutation({
    mutationFn: async (input: SetSaleStatusInput) => {
      const update: Record<string, unknown> = { sale_status: input.saleStatus }
      // sale_done talebi kapatır; not_completed'a geri dönüş kapanışı geri alır
      // (teklifler yeniden görünür olsun — sale_done olabilmesi için kabul edilmiş teklif vardı).
      if (input.saleStatus === 'sale_done') update.status = 'closed'
      else if (input.saleStatus === 'not_completed') update.status = 'offers_ready'
      const { error } = await supabase.from('request').update(update).eq('id', input.requestId)
      if (error) throw error

      const { error: auditErr } = await supabase.from('audit_log').insert({
        tenant_id: input.tenantId,
        actor_id: input.actorId,
        action: 'sale_status_change',
        entity: 'request',
        after: { sale_status: input.saleStatus },
      })
      if (auditErr) throw auditErr

      if (input.saleStatus === 'sale_done') {
        void supabase.functions
          .invoke('photo-lifecycle', { body: { mode: 'archive', requestId: input.requestId } })
          .catch(() => {})
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['request', variables.requestId] })
    },
    onError: () => show('Satış durumu güncellenemedi', 'error'),
  })
}
