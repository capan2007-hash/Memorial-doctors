import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useTheme } from '@/lib/theme'
import { spacing } from '@/theme'

/** Ortalanmış yükleme göstergesi (liste/ekran boyunca yeniden kullanılır). */
export function Spinner() {
  const { colors } = useTheme()
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.brandText} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.six, alignItems: 'center' },
})
