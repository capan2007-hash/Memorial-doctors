import { LogOut, ShieldCheck, User } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

const ROLE_LABEL: Record<string, string> = {
  coordinator: 'Koordinatör',
  admin: 'Yönetici',
  super_admin: 'Süper Admin',
}

export default function AdminSettingsScreen() {
  const { fullName, role, signOut } = useAuth()
  const { colors } = useTheme()

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surface2, borderColor: colors.border, borderRadius: radius.md },
  ]

  return (
    <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
      <View style={cardStyle}>
        <View style={styles.cardHeader}>
          <User color={colors.textSecondary} size={16} strokeWidth={1.75} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Kullanıcı</Text>
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{fullName ?? '—'}</Text>
        <View style={styles.roleRow}>
          <ShieldCheck color={colors.brandText} size={14} strokeWidth={2} />
          <Text style={[styles.role, { color: colors.brandText }]}>{ROLE_LABEL[role ?? ''] ?? role ?? '—'}</Text>
        </View>
      </View>

      <View>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Görünüm</Text>
        <ThemeToggle />
      </View>

      <Pressable
        style={[styles.signOutButton, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}
        onPress={signOut}
        accessibilityRole="button"
      >
        <LogOut color={colors.dangerText} size={18} strokeWidth={1.75} />
        <Text style={[styles.signOutButtonText, { color: colors.dangerText }]}>Çıkış</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.four, gap: spacing.four },
  card: { borderWidth: StyleSheet.hairlineWidth, padding: spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.one },
  label: { fontFamily: fontFamily.regular, fontSize: 13 },
  name: { fontFamily: fontFamily.semibold, fontSize: 18, marginTop: spacing.half },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.half, marginTop: spacing.one },
  role: { fontFamily: fontFamily.semibold, fontSize: 13 },
  sectionLabel: { fontFamily: fontFamily.medium, fontSize: 13, marginBottom: spacing.one, marginLeft: spacing.half },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    minHeight: 44,
  },
  signOutButtonText: { fontFamily: fontFamily.semibold },
})
