import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { SUPPORTED, type Lang } from '../../i18n'
import { LANG_LABELS } from '../../components/LanguageSwitcher'
import { buildShareText } from '../../pages/legal'

type Props = { value: Lang; onChange: (lang: Lang) => void }

/**
 * Onam kartı paylaşım satırı: satışçı hastanın dilini seçer ve aydınlatma
 * metninin linkini içeren hazır mesajı panoya kopyalar (kendi WhatsApp'ına
 * yapıştırır). Seçilen dil onam kaydına consent_lang olarak yazılır.
 */
export function ConsentShare({ value, onChange }: Props) {
  const { t } = useTranslation('requests')
  const toast = useToast()

  const copy = async () => {
    const text = buildShareText(value, window.location.origin)
    try {
      await navigator.clipboard.writeText(text)
      toast.show(t('newRequest.consentShareCopied'), 'success')
    } catch {
      toast.show(t('newRequest.consentShareCopyFailed'), 'error')
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-line bg-surface-2 p-3">
      <p className="text-sm font-medium text-ink-primary">{t('newRequest.consentShareTitle')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t('newRequest.consentShareTitle')}
          value={value}
          onChange={(e) => onChange(e.target.value as Lang)}
          className="h-9 rounded-control border border-line bg-surface px-2 text-sm text-ink-primary"
        >
          {SUPPORTED.map((code) => (
            <option key={code} value={code}>{LANG_LABELS[code]}</option>
          ))}
        </select>
        <Button variant="secondary" onClick={copy} type="button">
          <Icon of={Copy} className="me-1.5 h-4 w-4" />
          {t('newRequest.consentShareCopy')}
        </Button>
      </div>
    </div>
  )
}
