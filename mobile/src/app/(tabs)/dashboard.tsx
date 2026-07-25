import { useMemo } from 'react'
import { Award, BarChart3, Clock, Trophy } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/lib/theme'
import { fontFamily, radius, roleColors, spacing, type Palette } from '@/theme'
import { formatMins } from '@/domain/format'
import { scoreTier } from '@/domain/score'
import { comparable, rankTier, topPercentLabel } from '@/domain/rank'
import { useOwnPerformance, useOwnRanks, type OwnPerformance, type OwnRanks } from '@/features/profile/useOwnProfile'

/** Tek performans kutusu (Skor/Gelen/… tile'ı). */
function MetricTile({
  value,
  label,
  role,
  note,
  colors,
}: {
  value: string | number
  label: string
  role?: 'danger' | 'warning' | 'success'
  note?: string
  colors: Palette
}) {
  const tint = role ? roleColors(colors, role) : null
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: tint ? tint.bg : colors.surface1, borderColor: tint ? tint.border : colors.border },
      ]}
    >
      <Text style={[styles.tileValue, { color: tint ? tint.text : colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.textMuted }]}>{label}</Text>
      {note ? <Text style={[styles.tileNote, { color: tint ? tint.text : colors.textSecondary }]}>{note}</Text> : null}
    </View>
  )
}

function PerformanceSection({ perf, colors }: { perf: OwnPerformance; colors: Palette }) {
  const { t } = useTranslation('profile')
  const incoming = perf.accept_count + perf.reject_count + perf.pending_count
  const answered = perf.accept_count + perf.reject_count
  const tier = scoreTier(perf.score)
  return (
    <View style={styles.tileGrid}>
      <MetricTile value={perf.score} label={t('dashboard.performance.score')} role={tier.role} note={tier.label} colors={colors} />
      <MetricTile value={incoming} label={t('dashboard.performance.incoming')} colors={colors} />
      <MetricTile value={answered} label={t('dashboard.performance.answered')} colors={colors} />
      <MetricTile
        value={perf.avg_response_mins != null ? formatMins(perf.avg_response_mins) : '—'}
        label={t('dashboard.performance.avgResponse')}
        colors={colors}
      />
      <MetricTile value={perf.timely_count} label={t('dashboard.performance.timely')} colors={colors} />
      <MetricTile
        value={perf.breach_count}
        label={t('dashboard.performance.breach')}
        role={perf.breach_count > 0 ? 'danger' : undefined}
        colors={colors}
      />
    </View>
  )
}

/** Tek sıralama satırı: ikon + başlık + "3 / 8" + "üst %25" pill (tier renkli). */
function RankRow({
  icon,
  label,
  rank,
  total,
  pct,
  emptyText,
  colors,
}: {
  icon: React.ReactNode
  label: string
  rank: number | null
  total: number
  pct: number | null
  emptyText: string
  colors: Palette
}) {
  const { t } = useTranslation('profile')
  const has = rank != null && total > 0
  const tint = has ? roleColors(colors, rankTier(rank, total)) : null
  const pctLabel = has && comparable(total) ? topPercentLabel(pct) : null

  return (
    <View style={[styles.rankRow, { borderColor: colors.border, backgroundColor: colors.surface1 }]}>
      <View style={styles.rankLeft}>
        {icon}
        <Text style={[styles.rankLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      {has ? (
        <View style={styles.rankRight}>
          <Text style={[styles.rankValue, { color: colors.textPrimary }]}>
            {rank}
            <Text style={[styles.rankTotal, { color: colors.textMuted }]}> / {total}</Text>
          </Text>
          {pctLabel ? (
            <View style={[styles.pctPill, { backgroundColor: tint!.bg, borderColor: tint!.border }]}>
              <Text style={[styles.pctText, { color: tint!.text }]}>{pctLabel}</Text>
            </View>
          ) : (
            <Text style={[styles.rankNote, { color: colors.textMuted }]}>{t('dashboard.ranks.insufficientCompare')}</Text>
          )}
        </View>
      ) : (
        <Text style={[styles.rankNote, { color: colors.textMuted }]}>{emptyText}</Text>
      )}
    </View>
  )
}

function RankSection({ ranks, colors }: { ranks: OwnRanks; colors: Palette }) {
  const { t } = useTranslation('profile')
  return (
    <View style={styles.rankList}>
      <RankRow
        icon={<Trophy color={colors.textSecondary} size={16} strokeWidth={1.75} />}
        label={t('dashboard.ranks.scoreRank')}
        rank={ranks.score_rank}
        total={ranks.score_total}
        pct={ranks.score_pct}
        emptyText={t('dashboard.ranks.noRankScore')}
        colors={colors}
      />
      <RankRow
        icon={<Clock color={colors.textSecondary} size={16} strokeWidth={1.75} />}
        label={t('dashboard.ranks.responseRank')}
        rank={ranks.response_rank}
        total={ranks.response_total}
        pct={ranks.response_pct}
        emptyText={t('dashboard.ranks.noRankResponse')}
        colors={colors}
      />
    </View>
  )
}

export default function DashboardScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation('profile')
  const perf = useOwnPerformance()
  const ranks = useOwnRanks()

  const cardStyle = useMemo(
    () => [styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }],
    [colors],
  )

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.surface0 }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Performansım */}
      <View style={cardStyle}>
        <View style={styles.cardHeader}>
          <Award color={colors.textSecondary} size={18} strokeWidth={1.75} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('dashboard.performance.title')}</Text>
        </View>
        {perf.isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brandText} />
          </View>
        ) : perf.data ? (
          <PerformanceSection perf={perf.data} colors={colors} />
        ) : (
          <Text style={[styles.helperText, { color: colors.textMuted }]}>{t('dashboard.performance.empty')}</Text>
        )}
      </View>

      {/* Sıralamam */}
      <View style={cardStyle}>
        <View style={styles.cardHeader}>
          <BarChart3 color={colors.textSecondary} size={18} strokeWidth={1.75} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('dashboard.ranks.title')}</Text>
        </View>
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          {t('dashboard.ranks.subtitle')}
        </Text>
        {ranks.isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brandText} />
          </View>
        ) : ranks.data ? (
          <RankSection ranks={ranks.data} colors={colors} />
        ) : (
          <Text style={[styles.helperText, { color: colors.textMuted }]}>{t('dashboard.ranks.empty')}</Text>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { padding: spacing.four, gap: spacing.four },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.three,
    gap: spacing.two,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.one },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 16 },
  helperText: { fontFamily: fontFamily.regular, fontSize: 13 },
  loadingBox: { paddingVertical: spacing.four, alignItems: 'center' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.two, marginTop: spacing.half },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingVertical: spacing.two,
    paddingHorizontal: spacing.one,
    alignItems: 'center',
  },
  tileValue: { fontFamily: fontFamily.display, fontSize: 22, fontVariant: ['tabular-nums'] },
  tileLabel: { fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2, textAlign: 'center' },
  tileNote: { fontFamily: fontFamily.semibold, fontSize: 11, marginTop: 2 },
  rankList: { gap: spacing.two, marginTop: spacing.half },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingVertical: spacing.two,
    paddingHorizontal: spacing.two,
    minHeight: 56,
    gap: spacing.two,
  },
  rankLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.one, flexShrink: 1 },
  rankLabel: { fontFamily: fontFamily.medium, fontSize: 14 },
  rankRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  rankValue: { fontFamily: fontFamily.display, fontSize: 20, fontVariant: ['tabular-nums'] },
  rankTotal: { fontFamily: fontFamily.regular, fontSize: 14 },
  pctPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.two,
    paddingVertical: 2,
  },
  pctText: { fontFamily: fontFamily.semibold, fontSize: 12 },
  rankNote: { fontFamily: fontFamily.regular, fontSize: 12, flexShrink: 1, textAlign: 'right' },
})
