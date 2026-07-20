import { Moon, Sun } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

/** Yeniden kullanılabilir tema anahtarı satırı — açık/koyu arası geçiş yapar. */
export function ThemeToggle() {
  const { mode, colors, toggle } = useTheme()
  const isDark = mode === 'dark'
  const Icon = isDark ? Sun : Moon
  const label = isDark ? 'Açık tema' : 'Koyu tema'

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface2,
          borderColor: colors.border,
          borderRadius: radius.md,
        },
        pressed && { backgroundColor: colors.surface1 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
        <Icon color={colors.brandText} size={20} strokeWidth={1.75} />
      </View>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    minHeight: 52,
  },
  iconWrap: {
    height: 36,
    width: 36,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
})
