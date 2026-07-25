// Kaynak: /src/features/ai/AiPanel.tsx (web) — durumlar (hazırlanıyor spinner,
// failed satırı, ok/warning kart), Türkçe uyarı etiket haritası + %güven rozeti,
// disclaimer bandı ve Doğru/Kısmen doğru/Yanlış geri bildirim akışı aynı
// sözleşmeyle native'e taşındı. Bu uygulamada kullanıcı her zaman doktor
// olduğundan web'deki canGiveFeedback prop'u yerine yalnız doctorId kontrol edilir.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { AlertTriangle, Info, SlashIcon } from 'lucide-react-native'

import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing, type Palette } from '@/theme'
import type { AiFeedbackRow } from '@/types/db'
import { useAiEvaluation, useAiFeedbackFor } from './useAiEvaluation'
import { useSubmitAiFeedback } from './useAiFeedback'

const POLL_GIVE_UP_MS = 120_000

// Uyarı tipi anahtarları ai.json'daki warnings.* ile birebir eşleşir.
const WARNING_TYPES = ['photo_operation_mismatch', 'demographics_operation_risk', 'missing_data', 'photo_quality']

const FEEDBACK_OPTIONS: AiFeedbackRow['label'][] = ['correct', 'partial', 'wrong']

function FeedbackSection({
  tenantId,
  requestId,
  aiEvaluationId,
  doctorId,
}: {
  tenantId: string
  requestId: string
  aiEvaluationId: string
  doctorId: string
}) {
  const { colors } = useTheme()
  const { t } = useTranslation('ai')
  const styles = makeStyles(colors)
  const existing = useAiFeedbackFor(aiEvaluationId, doctorId)
  const submit = useSubmitAiFeedback()
  const [selected, setSelected] = useState<AiFeedbackRow['label'] | null>(null)
  const [note, setNote] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (existing.data) {
    return (
      <View style={styles.feedbackDivider}>
        <View style={styles.feedbackBadge}>
          <Text style={styles.feedbackBadgeText}>
            {t('feedback.yoursLabel', { label: t(`feedback.${existing.data.label}`) })}
          </Text>
        </View>
        {existing.data.note && <Text style={styles.feedbackNoteText}>{existing.data.note}</Text>}
      </View>
    )
  }

  return (
    <View style={[styles.feedbackDivider, styles.gap]}>
      <Text style={styles.feedbackPrompt}>{t('feedback.prompt')}</Text>
      <View style={styles.feedbackButtonsRow}>
        {FEEDBACK_OPTIONS.map((label) => {
          const isSelected = selected === label
          return (
            <Pressable
              key={label}
              style={[styles.feedbackButton, isSelected && styles.feedbackButtonSelected]}
              onPress={() => setSelected(label)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.feedbackButtonText, isSelected && styles.feedbackButtonTextSelected]}>
                {t(`feedback.${label}`)}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <TextInput
        style={styles.noteInput}
        placeholder={t('feedback.notePlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
      />
      <Pressable
        style={[styles.submitButton, (!selected || submit.isPending) && styles.buttonDisabled]}
        disabled={!selected || submit.isPending}
        onPress={() => {
          if (!selected) return
          setSubmitError(null)
          submit.mutate(
            {
              tenantId,
              requestId,
              aiEvaluationId,
              doctorId,
              label: selected,
              note: note || undefined,
            },
            { onError: () => setSubmitError(t('feedback.submitError')) },
          )
        }}
      >
        {submit.isPending ? (
          <ActivityIndicator color={colors.brandOn} />
        ) : (
          <Text style={styles.submitButtonText}>{t('feedback.submit')}</Text>
        )}
      </Pressable>
      {submitError && <Text style={styles.feedbackErrorText}>{submitError}</Text>}
    </View>
  )
}

export function AiPanel({ requestId, doctorId }: { requestId: string; doctorId?: string | null }) {
  const { tenantId } = useAuth()
  const { colors } = useTheme()
  const { t } = useTranslation('ai')
  const styles = makeStyles(colors)
  // Veri null kaldıkça React Query yeni render tetiklemez; süre kontrolü
  // ancak zamanlayıcıyla zorlanan bir render'da yeniden değerlendirilebilir.
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), POLL_GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [requestId])
  const q = useAiEvaluation(requestId)

  if (q.isLoading || (q.data == null && !gaveUp)) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.textSecondary} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    )
  }

  if (!q.data) return null

  const evaluation = q.data

  if (evaluation.status === 'failed') {
    return (
      <View style={styles.failedRow}>
        <SlashIcon color={colors.textMuted} size={16} strokeWidth={1.75} />
        <Text style={styles.failedText}>{t('failed')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('panel.title')}</Text>
      <View style={styles.band}>
        <Info color={colors.infoText} size={16} strokeWidth={1.75} />
        <Text style={styles.bandText}>{t('panel.disclaimer')}</Text>
      </View>
      {evaluation.warnings.length > 0 && (
        <View style={styles.gap}>
          {evaluation.warnings
            .filter((w) => WARNING_TYPES.includes(w.type))
            .map((w, i) => (
              <View key={i} style={styles.warningItem}>
                <View style={styles.warningHeaderRow}>
                  <AlertTriangle color={colors.warningText} size={16} strokeWidth={1.75} />
                  <Text style={styles.warningLabel}>{t(`warnings.${w.type}`)}</Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceBadgeText}>%{Math.round(w.confidence * 100)}</Text>
                  </View>
                </View>
                <Text style={styles.rationale}>{w.rationale}</Text>
              </View>
            ))}
        </View>
      )}
      <Text style={styles.suitabilityHeading}>{t('panel.suitabilityHeading')}</Text>
      <Text style={styles.suitabilityNote}>{evaluation.suitability_note}</Text>
      {doctorId && tenantId && (
        <FeedbackSection
          tenantId={tenantId}
          requestId={requestId}
          aiEvaluationId={evaluation.id}
          doctorId={doctorId}
        />
      )}
    </View>
  )
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.one,
      paddingHorizontal: spacing.half,
    },
    loadingText: {
      fontFamily: fontFamily.regular,
      fontSize: 13,
      color: colors.textSecondary,
    },
    failedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.one,
      paddingHorizontal: spacing.half,
    },
    failedText: {
      fontFamily: fontFamily.regular,
      fontSize: 13,
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.surface2,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.three,
      gap: spacing.two,
    },
    cardTitle: {
      fontFamily: fontFamily.display,
      fontSize: 17,
      color: colors.textPrimary,
    },
    band: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.one,
      backgroundColor: colors.infoBg,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.two,
      paddingVertical: spacing.one,
    },
    bandText: {
      flex: 1,
      fontFamily: fontFamily.medium,
      fontSize: 12,
      color: colors.infoText,
    },
    gap: {
      gap: spacing.two,
    },
    warningItem: {
      gap: 2,
    },
    warningHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.one,
    },
    warningLabel: {
      flex: 1,
      fontFamily: fontFamily.semibold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    confidenceBadge: {
      borderRadius: radius.full,
      backgroundColor: colors.warningBg,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    confidenceBadgeText: {
      fontFamily: fontFamily.semibold,
      fontSize: 11,
      color: colors.warningText,
      fontVariant: ['tabular-nums'],
    },
    rationale: {
      fontFamily: fontFamily.regular,
      fontSize: 13,
      color: colors.textSecondary,
    },
    suitabilityHeading: {
      fontFamily: fontFamily.display,
      fontSize: 15,
      color: colors.textPrimary,
    },
    suitabilityNote: {
      fontFamily: fontFamily.regular,
      fontSize: 14,
      color: colors.textSecondary,
    },
    feedbackDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.two,
      marginTop: spacing.half,
    },
    feedbackBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.brandFill,
      borderRadius: radius.full,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    feedbackBadgeText: {
      fontFamily: fontFamily.medium,
      fontSize: 12,
      color: colors.brandOn,
    },
    feedbackNoteText: {
      fontFamily: fontFamily.regular,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: spacing.one,
    },
    feedbackErrorText: {
      fontFamily: fontFamily.regular,
      fontSize: 13,
      color: colors.dangerText,
    },
    feedbackPrompt: {
      fontFamily: fontFamily.regular,
      fontSize: 14,
      color: colors.textSecondary,
    },
    feedbackButtonsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.one,
    },
    feedbackButton: {
      minHeight: 44,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface1,
      borderRadius: radius.full,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    feedbackButtonSelected: {
      borderColor: colors.brandFill,
      backgroundColor: colors.brandFill,
    },
    feedbackButtonText: {
      fontFamily: fontFamily.medium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    feedbackButtonTextSelected: {
      color: colors.brandOn,
    },
    noteInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.two,
      fontFamily: fontFamily.regular,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface1,
    },
    submitButton: {
      minHeight: 44,
      backgroundColor: colors.brandFill,
      borderRadius: radius.sm,
      paddingVertical: spacing.two,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: colors.brandOn,
      fontFamily: fontFamily.semibold,
      fontSize: 14,
    },
  })
