import { useState } from 'react'
import { Image } from 'expo-image'
import { ArrowDown, ImageOff, Sparkles, UserPlus } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { dupConfidenceClass, formatConfidencePct } from '@/domain/duplicate'
import { useDuplicateQueue, useResolveDuplicate, type DuplicateItem } from '@/features/admin/useDuplicateQueue'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, roleColors, shadow, spacing, type Palette } from '@/theme'

// AI güven eşiği (tenant.dup_confidence_threshold varsayılanı 0.75).
const CONFIDENCE_THRESHOLD = 0.75

function formatDate(x: string | null): string {
  if (!x) return '—'
  const d = new Date(x)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR')
}

function PhotoThumbs({ urls, colors }: { urls: string[]; colors: Palette }) {
  const { t } = useTranslation('admin')
  if (!urls.length) {
    return (
      <View style={styles.noPhoto}>
        <ImageOff color={colors.textMuted} size={14} strokeWidth={1.75} />
        <Text style={[styles.noPhotoText, { color: colors.textMuted }]}>{t('duplicates.noPhoto')}</Text>
      </View>
    )
  }
  const shown = urls.slice(0, 4)
  const extra = urls.length - shown.length
  return (
    <View style={styles.thumbRow}>
      {shown.map((u, i) => (
        <Image key={i} source={{ uri: u }} style={[styles.thumb, { borderColor: colors.border }]} contentFit="cover" />
      ))}
      {extra > 0 && (
        <View style={[styles.thumbMore, { borderColor: colors.border, backgroundColor: colors.surface1 }]}>
          <Text style={[styles.thumbMoreText, { color: colors.textMuted }]}>+{extra}</Text>
        </View>
      )}
    </View>
  )
}

function SidePanel({
  label,
  name,
  meta,
  urls,
  colors,
}: {
  label: string
  name: string
  meta: { k: string; v: string }[]
  urls: string[]
  colors: Palette
}) {
  return (
    <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.surface1 }]}>
      <Text style={[styles.panelLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.panelName, { color: colors.textPrimary }]}>{name}</Text>
      <View style={styles.metaList}>
        {meta.map((m) => (
          <View key={m.k} style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: colors.textMuted }]}>{m.k}:</Text>
            <Text style={[styles.metaVal, { color: colors.textSecondary }]} numberOfLines={1}>
              {m.v}
            </Text>
          </View>
        ))}
      </View>
      <PhotoThumbs urls={urls} colors={colors} />
    </View>
  )
}

function AiVerdict({ item, colors }: { item: DuplicateItem; colors: Palette }) {
  const { t } = useTranslation('admin')
  if (item.aiSame == null) {
    return (
      <View style={[styles.verdict, { borderColor: colors.border, backgroundColor: colors.surface1 }]}>
        <Sparkles color={colors.textMuted} size={16} strokeWidth={1.75} />
        <View style={styles.verdictBody}>
          <Text style={[styles.verdictTitle, { color: colors.textSecondary }]}>
            {t('duplicates.aiNoVerdict')}
          </Text>
          {item.aiReason ? <Text style={[styles.verdictReason, { color: colors.textMuted }]}>{item.aiReason}</Text> : null}
        </View>
      </View>
    )
  }
  const cls = dupConfidenceClass(item.aiConfidence, CONFIDENCE_THRESHOLD)
  const tint = roleColors(colors, cls === 'high' ? 'success' : 'warning')
  return (
    <View style={[styles.verdict, { borderColor: tint.border, backgroundColor: tint.bg }]}>
      <Sparkles color={tint.text} size={16} strokeWidth={2} />
      <View style={styles.verdictBody}>
        <Text style={[styles.verdictTitleStrong, { color: tint.text }]}>
          {t('duplicates.aiSamePerson', { pct: formatConfidencePct(item.aiConfidence) })}
        </Text>
        {item.aiReason ? <Text style={[styles.verdictReason, { color: tint.text }]}>{item.aiReason}</Text> : null}
      </View>
    </View>
  )
}

function DuplicateCard({ item, colors }: { item: DuplicateItem; colors: Palette }) {
  const { t } = useTranslation('admin')
  const resolve = useResolveDuplicate()
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<'confirmed' | 'dismissed' | null>(null)

  const decide = async (decision: 'confirmed' | 'dismissed') => {
    setPending(decision)
    try {
      await resolve.mutateAsync({ requestId: item.requestId, decision, note: note.trim() || undefined })
      Alert.alert(
        t('duplicates.alerts.decidedTitle'),
        decision === 'confirmed' ? t('duplicates.alerts.confirmedMessage') : t('duplicates.alerts.dismissedMessage'),
      )
    } catch (e) {
      Alert.alert(t('duplicates.alerts.failedTitle'), (e as Error).message)
    } finally {
      setPending(null)
    }
  }

  const busy = pending !== null

  return (
    <View style={[styles.card, shadow.card, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
      <SidePanel
        label={t('duplicates.newApplication')}
        name={item.patientName}
        meta={[
          { k: t('duplicates.phone'), v: item.phone ?? '—' },
          { k: t('duplicates.category'), v: item.categoryName },
          { k: t('duplicates.date'), v: formatDate(item.createdAt) },
        ]}
        urls={item.newPhotos}
        colors={colors}
      />
      <View style={styles.arrow}>
        <ArrowDown color={colors.textMuted} size={18} strokeWidth={1.75} />
      </View>
      <SidePanel
        label={t('duplicates.parentRequest')}
        name={item.parentPatientName}
        meta={[
          { k: t('duplicates.date'), v: formatDate(item.parentCreatedAt) },
          { k: t('duplicates.requestIdLabel'), v: item.parentRequestId.slice(0, 8) },
        ]}
        urls={item.parentPhotos}
        colors={colors}
      />

      <AiVerdict item={item} colors={colors} />

      <View>
        <Text style={[styles.noteLabel, { color: colors.textMuted }]}>{t('duplicates.noteLabel')}</Text>
        <TextInput
          style={[styles.noteInput, { borderColor: colors.border, backgroundColor: colors.surface1, color: colors.textPrimary }]}
          placeholder={t('duplicates.notePlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => decide('dismissed')}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.surface1 }, busy && styles.disabled]}
        >
          {pending === 'dismissed' ? (
            <ActivityIndicator color={colors.brandText} size="small" />
          ) : (
            <>
              <UserPlus color={colors.textSecondary} size={15} strokeWidth={1.75} />
              <Text style={[styles.btnSecondaryText, { color: colors.textSecondary }]}>{t('duplicates.notDuplicateButton')}</Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => decide('confirmed')}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.btnPrimary, shadow.card, { backgroundColor: colors.brandFill }, busy && styles.disabled]}
        >
          {pending === 'confirmed' ? (
            <ActivityIndicator color={colors.brandOn} size="small" />
          ) : (
            <Text style={[styles.btnPrimaryText, { color: colors.brandOn }]}>{t('duplicates.confirmDuplicateButton')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

export default function MukerrerScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation('admin')
  const queue = useDuplicateQueue()

  if (queue.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
        <Spinner />
      </View>
    )
  }

  if (!queue.data || queue.data.length === 0) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.surface0 }]}>
        <EmptyState title={t('duplicates.emptyTitle')} description={t('duplicates.emptyDescription')} />
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
      <FlatList
        data={queue.data}
        keyExtractor={(item) => item.requestId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <DuplicateCard item={item} colors={colors} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { justifyContent: 'center' },
  list: { padding: spacing.four, gap: spacing.four },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.three,
    gap: spacing.two,
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.three,
    gap: spacing.one,
  },
  panelLabel: { fontFamily: fontFamily.semibold, fontSize: 10, letterSpacing: 0.5 },
  panelName: { fontFamily: fontFamily.semibold, fontSize: 15 },
  metaList: { gap: 2 },
  metaRow: { flexDirection: 'row', gap: spacing.half },
  metaKey: { fontFamily: fontFamily.regular, fontSize: 13 },
  metaVal: { fontFamily: fontFamily.regular, fontSize: 13, flex: 1 },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.half },
  thumb: { width: 60, height: 60, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  thumbMore: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMoreText: { fontFamily: fontFamily.medium, fontSize: 12, fontVariant: ['tabular-nums'] },
  noPhoto: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.half },
  noPhotoText: { fontFamily: fontFamily.regular, fontSize: 12 },
  arrow: { alignItems: 'center' },
  verdict: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.three,
  },
  verdictBody: { flex: 1, gap: 2 },
  verdictTitle: { fontFamily: fontFamily.medium, fontSize: 13 },
  verdictTitleStrong: { fontFamily: fontFamily.semibold, fontSize: 14 },
  verdictReason: { fontFamily: fontFamily.regular, fontSize: 12 },
  noteLabel: { fontFamily: fontFamily.medium, fontSize: 12, marginBottom: spacing.half },
  noteInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.two,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    minHeight: 64,
  },
  actions: { gap: spacing.two, marginTop: spacing.half },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    minHeight: 44,
  },
  btnSecondaryText: { fontFamily: fontFamily.medium, fontSize: 14 },
  btnPrimary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    minHeight: 44,
  },
  btnPrimaryText: { fontFamily: fontFamily.semibold, fontSize: 15 },
  disabled: { opacity: 0.5 },
})
