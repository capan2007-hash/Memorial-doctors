import { useState } from 'react'
import { Bell, LogOut, User } from 'lucide-react-native'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { registerForPush, usePushSetup } from '@/features/push/usePushRegistration'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

export default function SettingsScreen() {
  const { fullName, doctorId, tenantId, signOut } = useAuth()
  const { permissionStatus, refresh } = usePushSetup(doctorId, tenantId)
  const [requesting, setRequesting] = useState(false)
  const { colors } = useTheme()

  const granted = permissionStatus === 'granted'
  const permissionLabel =
    permissionStatus === null ? '—' : granted ? 'İzin verildi' : 'İzin verilmedi'

  const requestPermission = async () => {
    if (!doctorId || !tenantId) return
    setRequesting(true)
    try {
      await registerForPush(doctorId, tenantId)
      await refresh()
    } finally {
      setRequesting(false)
    }
  }

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surface2, borderColor: colors.border, borderRadius: radius.md },
  ]

  return (
    <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
      <View style={cardStyle}>
        <View style={styles.cardHeader}>
          <User color={colors.textSecondary} size={16} strokeWidth={1.75} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Doktor</Text>
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{fullName ?? '—'}</Text>
      </View>

      <View style={cardStyle}>
        <View style={styles.cardHeader}>
          <Bell color={colors.textSecondary} size={16} strokeWidth={1.75} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Bildirimler</Text>
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{permissionLabel}</Text>
        {!granted && (
          <Pressable
            style={[
              styles.permissionButton,
              { backgroundColor: colors.brandFill },
              requesting && styles.buttonDisabled,
            ]}
            onPress={requestPermission}
            disabled={requesting}
            accessibilityRole="button"
          >
            {requesting ? (
              <ActivityIndicator color={colors.brandOn} />
            ) : (
              <Text style={[styles.permissionButtonText, { color: colors.brandOn }]}>
                Bildirimlere izin ver
              </Text>
            )}
          </Pressable>
        )}
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
  root: {
    flex: 1,
    padding: spacing.four,
    gap: spacing.four,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  sectionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    marginBottom: spacing.one,
    marginLeft: spacing.half,
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    marginTop: spacing.half,
  },
  permissionButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.two,
    minHeight: 44,
  },
  permissionButtonText: {
    fontFamily: fontFamily.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
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
  signOutButtonText: {
    fontFamily: fontFamily.semibold,
  },
})
