import { StyleSheet, Text, View } from 'react-native'

import { colors, fontFamily, spacing } from '@/theme'

export default function HistoryScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Geçmiş</Text>
      <Text style={styles.hint}>Yanıtladığınız talepler yakında burada listelenecek.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    backgroundColor: colors.surface,
    padding: spacing.four,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    color: colors.slate[900],
  },
  hint: {
    fontFamily: fontFamily.regular,
    color: colors.slate[500],
    textAlign: 'center',
  },
})
