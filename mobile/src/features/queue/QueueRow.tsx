import type { ReactNode } from 'react'
import { ChevronRight, Clock } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { timeAgo } from '@/domain/format'
import type { SlaInfo } from '@/domain/sla'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, roleColors, spacing } from '@/theme'

// FR-24/25/26/29: kuyruk satırı SLA geri sayım rozeti (bkz. web DoctorQueue.tsx aynı desen).
export function SlaBadge({ state, label }: { state: SlaInfo['state']; label: string }) {
  const { colors } = useTheme()
  const role = state === 'overdue' ? 'danger' : 'warning'
  const c = roleColors(colors, role)
  return (
    <View style={[slaBadgeStyles.root, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Clock color={c.text} size={12} strokeWidth={2} />
      <Text style={[slaBadgeStyles.text, { color: c.text }]}>{label}</Text>
    </View>
  )
}

const slaBadgeStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.half,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-end',
  },
  text: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
  },
})

export function QueueRow({
  patientName,
  categoryName,
  assignedAt,
  onPress,
  badge,
}: {
  patientName: string
  categoryName: string
  assignedAt: string
  onPress: () => void
  badge?: ReactNode
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface2,
          borderColor: colors.border,
          borderRadius: radius.md,
        },
        pressed && { backgroundColor: colors.surface1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.main}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {patientName}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {categoryName}
        </Text>
      </View>
      <View style={styles.aside}>
        {badge}
        <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(assignedAt)}</Text>
      </View>
      <ChevronRight color={colors.textMuted} size={20} strokeWidth={1.75} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.three,
    minHeight: 64,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  aside: {
    alignItems: 'flex-end',
    gap: spacing.half,
  },
  time: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
})
