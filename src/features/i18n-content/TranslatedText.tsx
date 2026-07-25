import { useState, type ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import { useTranslated } from './useTranslated'

export interface TranslatedTextProps {
  text: string | null | undefined
  sourceLang: string
  className?: string
  /** Sarmalayıcı eleman (varsayılan `div`) — çok satırlı içerik için genelde blok eleman uygundur. */
  as?: ElementType
  /**
   * Dense liste/tablo satırları için: "otomatik çeviri" etiketi ve orijinali
   * göster/gizle toggle'ı GÖSTERİLMEZ — yalnız çevrilmiş metin render edilir,
   * orijinal metin native `title` tooltip'inde (hover) sunulur.
   */
  compact?: boolean
}

/**
 * Serbest metni (hasta notu, doktor yanıtı vb.) gerektiğinde otomatik çevirip
 * gösterir. Kaynak dil = hedef dil ise düz metin döner, HİÇBİR etiket eklenmez.
 * Çeviri varsa "otomatik çeviri" etiketi + orijinal/çeviri geçiş butonu eklenir
 * (compact modunda bu etiket/toggle bastırılır, orijinal yalnız title tooltip'inde).
 */
export function TranslatedText({ text, sourceLang, className, as: Component = 'div', compact = false }: TranslatedTextProps) {
  const { t } = useTranslation('common')
  const [showOriginal, setShowOriginal] = useState(false)
  const { text: resolvedText, isTranslated, isLoading } = useTranslated(text, sourceLang)

  // Kaynak=hedef (veya sessiz hata fallback'i): düz metin, etiket yok.
  if (!isTranslated && !isLoading) {
    return <Component className={`whitespace-pre-wrap ${className ?? ''}`}>{resolvedText}</Component>
  }

  if (compact) {
    // Yükleniyorken orijinali opak göster; orijinal metin her zaman title tooltip'inde.
    return (
      <Component
        className={`whitespace-pre-wrap ${isLoading ? 'opacity-60' : ''} ${className ?? ''}`}
        title={text ?? ''}
      >
        {resolvedText}
      </Component>
    )
  }

  const displayText = showOriginal ? (text ?? '') : resolvedText

  return (
    <Component className={`whitespace-pre-wrap ${isLoading ? 'opacity-60' : ''} ${className ?? ''}`}>
      {displayText}
      {isTranslated && (
        <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
          <span>{t('autoTranslated')}</span>
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="underline hover:text-ink-secondary"
          >
            {showOriginal ? t('showTranslation') : t('showOriginal')}
          </button>
        </span>
      )}
    </Component>
  )
}
