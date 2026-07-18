import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { timeAgo } from '@/domain/format'
import { colors, fontFamily, radius, spacing } from '@/theme'

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
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {patientName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {categoryName}
        </Text>
      </View>
      <View style={styles.aside}>
        {badge}
        <Text style={styles.time}>{timeAgo(assignedAt)}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.three,
  },
  rowPressed: {
    backgroundColor: colors.brand[50],
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.slate[900],
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.slate[500],
  },
  aside: {
    alignItems: 'flex-end',
    gap: spacing.half,
  },
  time: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.slate[400],
  },
  chevron: {
    fontSize: 22,
    color: colors.slate[300],
    fontFamily: fontFamily.regular,
  },
})
