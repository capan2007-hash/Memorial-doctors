import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { AiPanel } from '../ai/AiPanel'

/**
 * Satışçı talebi oluşturup onam verince gösterilen AI ön-değerlendirme ekranı.
 * AiPanel salt-okunur (doctorId verilmez → geri-bildirim yok); değerlendirme
 * hazır olana kadar poll eder, hazır olunca uygunluk + uyarıları gösterir.
 * "Tamam" her zaman görünür — satışçı sonucu bekleyip devam eder, bloke değil.
 */
export function AiPreviewScreen({ requestId, onDone }: { requestId: string; onDone: () => void }) {
  const { t } = useTranslation('requests')
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-fill/10 text-brand-text">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {t('newRequest.aiPreview.title')}
          </h1>
          <p className="mt-0.5 text-sm text-ink-secondary">{t('newRequest.aiPreview.subtitle')}</p>
        </div>
      </div>

      <AiPanel requestId={requestId} />

      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={onDone}>
          {t('newRequest.aiPreview.done')}
        </Button>
      </div>
    </div>
  )
}
