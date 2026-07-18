// Kaynak: /src/features/ai/AiPanel.tsx (web) — durumlar (hazırlanıyor spinner,
// failed satırı, ok/warning kart), Türkçe uyarı etiket haritası + %güven rozeti,
// disclaimer bandı ve Doğru/Kısmen doğru/Yanlış geri bildirim akışı aynı
// sözleşmeyle native'e taşındı. Bu uygulamada kullanıcı her zaman doktor
// olduğundan web'deki canGiveFeedback prop'u yerine yalnız doctorId kontrol edilir.
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { colors, fontFamily, radius, spacing } from '@/theme'
import type { AiFeedbackRow } from '@/types/db'
import { useAiEvaluation, useAiFeedbackFor } from './useAiEvaluation'
import { useSubmitAiFeedback } from './useAiFeedback'

const POLL_GIVE_UP_MS = 120_000

const WARNING_LABELS: Record<string, string> = {
  photo_operation_mismatch: 'Fotoğraf–operasyon uyumsuzluğu',
  demographics_operation_risk: 'Demografi–operasyon riski',
  missing_data: 'Eksik veri',
  photo_quality: 'Fotoğraf kalitesi',
}

const FEEDBACK_LABELS: Record<AiFeedbackRow['label'], string> = {
  correct: 'Doğru',
  partial: 'Kısmen doğru',
  wrong: 'Yanlış',
}

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
  const existing = useAiFeedbackFor(aiEvaluationId, doctorId)
  const submit = useSubmitAiFeedback()
  const [selected, setSelected] = useState<AiFeedbackRow['label'] | null>(null)
  const [note, setNote] = useState('')

  if (existing.data) {
    return (
      <View style={styles.feedbackDivider}>
        <View style={styles.feedbackBadge}>
          <Text style={styles.feedbackBadgeText}>
            Geri bildiriminiz: {FEEDBACK_LABELS[existing.data.label]}
          </Text>
        </View>
        {existing.data.note && <Text style={styles.feedbackNoteText}>{existing.data.note}</Text>}
      </View>
    )
  }

  return (
    <View style={[styles.feedbackDivider, styles.gap]}>
      <Text style={styles.feedbackPrompt}>Bu değerlendirme:</Text>
      <View style={styles.feedbackButtonsRow}>
        {FEEDBACK_OPTIONS.map((label) => {
          const isSelected = selected === label
          return (
            <Pressable
              key={label}
              style={[styles.feedbackButton, isSelected && styles.feedbackButtonSelected]}
              onPress={() => setSelected(label)}
            >
              <Text style={[styles.feedbackButtonText, isSelected && styles.feedbackButtonTextSelected]}>
                {FEEDBACK_LABELS[label]}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <TextInput
        style={styles.noteInput}
        placeholder="İsteğe bağlı not"
        placeholderTextColor={colors.slate[400]}
        value={note}
        onChangeText={setNote}
      />
      <Pressable
        style={[styles.submitButton, (!selected || submit.isPending) && styles.buttonDisabled]}
        disabled={!selected || submit.isPending}
        onPress={() => {
          if (!selected) return
          submit.mutate({
            tenantId,
            requestId,
            aiEvaluationId,
            doctorId,
            label: selected,
            note: note || undefined,
          })
        }}
      >
        {submit.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Gönder</Text>
        )}
      </Pressable>
    </View>
  )
}

export function AiPanel({ requestId, doctorId }: { requestId: string; doctorId?: string | null }) {
  const { tenantId } = useAuth()
  // Veri null kaldıkça React Query yeni render tetiklemez; süre kontrolü
  // ancak zamanlayıcıyla zorlanan bir render'da yeniden değerlendirilebilir.
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), POLL_GIVE_UP_MS)
    return () => clearTimeout(t)
  }, [requestId])
  const q = useAiEvaluation(requestId)

  if (q.isLoading || (q.data == null && !gaveUp)) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.slate[500]} />
        <Text style={styles.loadingText}>AI değerlendirmesi hazırlanıyor…</Text>
      </View>
    )
  }

  if (!q.data) return null

  const evaluation = q.data

  if (evaluation.status === 'failed') {
    return <Text style={styles.failedText}>AI değerlendirmesi yapılamadı</Text>
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>AI Triyaj Değerlendirmesi</Text>
      <View style={styles.band}>
        <Text style={styles.bandText}>Yön göstericidir; nihai karar hekimindir.</Text>
      </View>
      {evaluation.warnings.length > 0 && (
        <View style={styles.gap}>
          {evaluation.warnings
            .filter((w) => WARNING_LABELS[w.type])
            .map((w, i) => (
              <View key={i} style={styles.warningItem}>
                <View style={styles.warningHeaderRow}>
                  <Text style={styles.warningLabel}>{WARNING_LABELS[w.type]}</Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceBadgeText}>%{Math.round(w.confidence * 100)}</Text>
                  </View>
                </View>
                <Text style={styles.rationale}>{w.rationale}</Text>
              </View>
            ))}
        </View>
      )}
      <Text style={styles.suitabilityHeading}>Uygunluk değerlendirmesi</Text>
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

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    paddingHorizontal: spacing.half,
  },
  loadingText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.slate[500],
  },
  failedText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.slate[500],
    paddingHorizontal: spacing.half,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.three,
    gap: spacing.two,
  },
  cardTitle: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    color: colors.slate[900],
  },
  band: {
    backgroundColor: colors.accent[100],
    borderRadius: radius.md,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.one,
  },
  bandText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.accent[700],
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
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.slate[800],
  },
  confidenceBadge: {
    borderRadius: radius.full,
    backgroundColor: colors.accent[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  confidenceBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.accent[700],
  },
  rationale: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.slate[600],
  },
  suitabilityHeading: {
    fontFamily: fontFamily.display,
    fontSize: 15,
    color: colors.slate[900],
  },
  suitabilityNote: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.slate[700],
  },
  feedbackDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: spacing.two,
    marginTop: spacing.half,
  },
  feedbackBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand[100],
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  feedbackBadgeText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.brand[700],
  },
  feedbackNoteText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.slate[600],
    marginTop: spacing.one,
  },
  feedbackPrompt: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.slate[700],
  },
  feedbackButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.one,
  },
  feedbackButton: {
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  feedbackButtonSelected: {
    borderColor: colors.brand[600],
    borderWidth: 2,
    backgroundColor: colors.brand[50],
  },
  feedbackButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.slate[700],
  },
  feedbackButtonTextSelected: {
    color: colors.brand[700],
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: radius.md,
    padding: spacing.two,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.slate[900],
    backgroundColor: colors.card,
  },
  submitButton: {
    backgroundColor: colors.brand[600],
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.semibold,
    fontSize: 14,
  },
})
