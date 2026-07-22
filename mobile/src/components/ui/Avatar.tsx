import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/lib/theme'
import { fontFamily } from '@/theme'

/** Baş harf rozeti — hasta/kullanıcı adından türetilir. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme()
  const initial = name.trim().charAt(0).toUpperCase() || '—'
  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface3,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.initial, { color: colors.textSecondary, fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  initial: { fontFamily: fontFamily.semibold },
})
