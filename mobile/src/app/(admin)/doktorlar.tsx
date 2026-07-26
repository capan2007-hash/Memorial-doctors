import { router } from 'expo-router'
import { ChevronRight, Plus } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { formatMins } from '@/domain/format'
import { scoreTier } from '@/domain/score'
import { useDoctorPerformance, useDoctorsFull, type DoctorPerformanceRow, type DoctorWithScopes } from '@/features/admin/useDoctors'
import { TranslatedText } from '@/features/i18n-content/TranslatedText'
import { useTheme } from '@/lib/theme'
import { rtlIconStyle } from '@/lib/rtl'
import { fontFamily, radius, roleColors, shadow, spacing, type Palette } from '@/theme'

function Stat({ label, value, colors }: { label: string; value: string | number; colors: Palette }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  )
}

function DoctorCard({
  doctor,
  perf,
  colors,
}: {
  doctor: DoctorWithScopes
  perf: DoctorPerformanceRow | undefined
  colors: Palette
}) {
  const { t } = useTranslation('admin')
  const name = doctor.title || t('roles.doctor')
  const tier = scoreTier(perf?.score ?? doctor.score, t)
  const tint = roleColors(colors, tier.role)
  const inactiveTint = !doctor.is_active ? roleColors(colors, 'neutral') : null

  return (
    <Pressable
      onPress={() => router.push(`/doktor/${doctor.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        shadow.card,
        { backgroundColor: colors.surface2, borderColor: colors.border },
        pressed && { backgroundColor: colors.surface1, opacity: 0.9 },
      ]}
    >
      <View style={styles.cardTop}>
        {/* Avatar baş-harfi HAM kalır (kanonik TR/orijinal unvan) — yalnız görünen metin çevrilir. */}
        <Avatar name={name} size={44} />
        <View style={styles.cardHead}>
          {doctor.title ? (
            <TranslatedText
              text={doctor.title}
              sourceLang="tr"
              compact
              numberOfLines={1}
              style={[styles.name, { color: colors.textPrimary }]}
            />
          ) : (
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {name}
            </Text>
          )}
          {doctor.specialty ? (
            <TranslatedText
              text={doctor.specialty}
              sourceLang="tr"
              compact
              numberOfLines={1}
              style={[styles.specialty, { color: colors.textMuted }]}
            />
          ) : (
            <Text style={[styles.specialty, { color: colors.textMuted }]} numberOfLines={1}>
              —
            </Text>
          )}
        </View>
        {inactiveTint && (
          <View style={[styles.badge, { backgroundColor: inactiveTint.bg, borderColor: inactiveTint.border }]}>
            <View style={[styles.badgeDot, { backgroundColor: inactiveTint.text }]} />
            <Text style={[styles.badgeText, { color: inactiveTint.text }]}>{t('doctorsList.inactiveBadge')}</Text>
          </View>
        )}
        <ChevronRight color={colors.textMuted} size={18} strokeWidth={1.75} style={rtlIconStyle} />
      </View>

      <View style={[styles.statRow, { borderTopColor: colors.border }]}>
        <View style={[styles.scoreChip, { backgroundColor: tint.bg }]}>
          <Text style={[styles.scoreValue, { color: tint.text }]}>{perf?.score ?? doctor.score}</Text>
          <Text style={[styles.scoreLabel, { color: tint.text }]}>{t('doctorsList.stats.score')}</Text>
        </View>
        <Stat label={t('doctorsList.stats.accept')} value={perf?.accept_count ?? 0} colors={colors} />
        <Stat label={t('doctorsList.stats.reject')} value={perf?.reject_count ?? 0} colors={colors} />
        <Stat
          label={t('doctorsList.stats.avgResponse')}
          value={perf?.avg_response_mins != null ? formatMins(perf.avg_response_mins, t) : '—'}
          colors={colors}
        />
      </View>
    </Pressable>
  )
}

export default function DoktorlarScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation('admin')
  const doctors = useDoctorsFull()
  const perf = useDoctorPerformance()

  const perfMap = new Map((perf.data ?? []).map((p) => [p.doctor_id, p]))

  const NewButton = (
    <Pressable
      onPress={() => router.push('/doktor/yeni')}
      accessibilityRole="button"
      style={[styles.newBtn, { backgroundColor: colors.brandFill }]}
    >
      <Plus color={colors.brandOn} size={18} strokeWidth={2} />
      <Text style={[styles.newBtnText, { color: colors.brandOn }]}>{t('doctorsList.newButton')}</Text>
    </Pressable>
  )

  if (doctors.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
        <View style={styles.list}>
          <SkeletonList count={6} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
      <FlatList
        data={doctors.data ?? []}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<View style={styles.header}>{NewButton}</View>}
        ListEmptyComponent={<EmptyState title={t('doctorsList.emptyTitle')} description={t('doctorsList.emptyDescription')} />}
        renderItem={({ item }) => <DoctorCard doctor={item} perf={perfMap.get(item.id)} colors={colors} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: spacing.four, gap: spacing.three },
  header: { marginBottom: spacing.one },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    minHeight: 44,
  },
  newBtnText: { fontFamily: fontFamily.semibold, fontSize: 15 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.three,
    gap: spacing.two,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  cardHead: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamily.semibold, fontSize: 15 },
  specialty: { fontFamily: fontFamily.regular, fontSize: 13, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.one + 2,
    paddingVertical: 3,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: fontFamily.medium, fontSize: 11 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.three, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.two },
  scoreChip: { alignItems: 'center', borderRadius: radius.sm, paddingHorizontal: spacing.two, paddingVertical: 4 },
  scoreValue: { fontFamily: fontFamily.display, fontSize: 18, fontVariant: ['tabular-nums'] },
  scoreLabel: { fontFamily: fontFamily.regular, fontSize: 10 },
  stat: { alignItems: 'center' },
  statValue: { fontFamily: fontFamily.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: fontFamily.regular, fontSize: 11, marginTop: 1 },
})
