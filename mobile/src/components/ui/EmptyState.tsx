import { StyleSheet, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/lib/theme'
import { fontFamily, spacing } from '@/theme'

/** Boş liste / yakında durumu: opsiyonel ikon + başlık + açıklama. */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon
  title: string
  description?: string
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.wrap}>
      {Icon ? <Icon color={colors.textMuted} size={28} strokeWidth={1.5} /> : null}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {description ? <Text style={[styles.desc, { color: colors.textSecondary }]}>{description}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: spacing.six, gap: spacing.two },
  title: { fontFamily: fontFamily.display, fontSize: 16, textAlign: 'center' },
  desc: { fontFamily: fontFamily.regular, fontSize: 13, textAlign: 'center', maxWidth: 280 },
})
