import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { colors, fontFamily, radius, spacing } from '@/theme'

export default function SettingsScreen() {
  const { fullName, signOut } = useAuth()

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.label}>Doktor</Text>
        <Text style={styles.name}>{fullName ?? '—'}</Text>
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutButtonText}>Çıkış</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.four,
    gap: spacing.four,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.three,
  },
  label: {
    fontFamily: fontFamily.regular,
    color: colors.slate[500],
    fontSize: 13,
  },
  name: {
    fontFamily: fontFamily.semibold,
    color: colors.slate[900],
    fontSize: 18,
    marginTop: spacing.half,
  },
  signOutButton: {
    backgroundColor: colors.danger[600],
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.semibold,
  },
})
