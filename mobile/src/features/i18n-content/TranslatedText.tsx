// Kaynak deseni: /src/features/i18n-content/TranslatedText.tsx (web) — RN karşılığı.
// Faz M2 Task 9. Serbest metni (hasta notu, doktor yanıtı vb.) gerektiğinde otomatik
// çevirip gösterir. Kaynak dil = hedef dil ise düz metin döner, HİÇBİR etiket eklenmez.
// Çeviri varsa "otomatik çeviri" etiketi + orijinal/çeviri geçiş butonu eklenir
// (compact modunda bu etiket/toggle bastırılır, yalnız çevrilmiş metin render edilir).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'

import { useTheme } from '@/lib/theme'
import { fontFamily } from '@/theme'
import { useTranslated } from './useTranslated'

export interface TranslatedTextProps {
  text: string | null | undefined
  sourceLang: string
  style?: StyleProp<TextStyle>
  /**
   * Dense liste/tablo satırları için: "otomatik çeviri" etiketi ve orijinali
   * göster/gizle toggle'ı GÖSTERİLMEZ — yalnız çevrilmiş metin render edilir.
   */
  compact?: boolean
  /**
   * Render edilen metin `<Text>`'ine geçirilir. Verilmezse (undefined) mevcut
   * davranış (sınırsız satır) korunur.
   */
  numberOfLines?: number
}

export function TranslatedText({
  text,
  sourceLang,
  style,
  compact = false,
  numberOfLines,
}: TranslatedTextProps) {
  const { colors } = useTheme()
  const { t } = useTranslation('common')
  const [showOriginal, setShowOriginal] = useState(false)
  const { text: resolvedText, isTranslated, isLoading } = useTranslated(text, sourceLang)

  // Kaynak=hedef (veya sessiz hata fallback'i): düz metin, etiket yok.
  if (!isTranslated && !isLoading) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {resolvedText}
      </Text>
    )
  }

  if (compact) {
    // Yükleniyorken orijinali opak göster.
    return (
      <Text style={[style, isLoading && styles.loading]} numberOfLines={numberOfLines}>
        {resolvedText}
      </Text>
    )
  }

  const displayText = showOriginal ? (text ?? '') : resolvedText

  return (
    <View style={styles.container}>
      <Text style={[style, isLoading && styles.loading]} numberOfLines={numberOfLines}>
        {displayText}
      </Text>
      {isTranslated && (
        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>{t('autoTranslated')}</Text>
          <Pressable
            onPress={() => setShowOriginal((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showOriginal ? t('showTranslation') : t('showOriginal')}
            hitSlop={6}
          >
            <Text style={[styles.metaText, styles.link, { color: colors.textMuted }]}>
              {showOriginal ? t('showTranslation') : t('showOriginal')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  loading: {
    opacity: 0.6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
  },
  link: {
    textDecorationLine: 'underline',
  },
})
