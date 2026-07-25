import { StyleSheet, View } from 'react-native'

import { useTheme } from '@/lib/theme'
import { radius, spacing } from '@/theme'

/** Tek iskelet satırı: avatar + iki metin çizgisi (theme.surface tonları, animasyonsuz). */
export function SkeletonRow() {
  const { colors } = useTheme()
  return (
    <View style={[styles.row, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.surface3 }]} />
      <View style={styles.lines}>
        <View style={[styles.lineWide, { backgroundColor: colors.surface3 }]} />
        <View style={[styles.lineNarrow, { backgroundColor: colors.surface3 }]} />
      </View>
    </View>
  )
}

/** Yükleme durumunda liste yerine gösterilen iskelet satır grubu (Spinner yerine). */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list} accessibilityElementsHidden accessibilityLabel="loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.two, paddingTop: spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.three,
    minHeight: 64,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  lines: { flex: 1, gap: spacing.one },
  lineWide: { height: 14, borderRadius: radius.sm, width: '60%' },
  lineNarrow: { height: 11, borderRadius: radius.sm, width: '35%' },
})
