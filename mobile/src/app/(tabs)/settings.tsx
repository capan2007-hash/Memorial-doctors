import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { registerForPush, usePushSetup } from '@/features/push/usePushRegistration'
import { colors, fontFamily, radius, spacing } from '@/theme'

export default function SettingsScreen() {
  const { fullName, doctorId, tenantId, signOut } = useAuth()
  const { permissionStatus, refresh } = usePushSetup(doctorId, tenantId)
  const [requesting, setRequesting] = useState(false)

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

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.label}>Doktor</Text>
        <Text style={styles.name}>{fullName ?? '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Bildirimler</Text>
        <Text style={styles.name}>{permissionLabel}</Text>
        {!granted && (
          <Pressable
            style={[styles.permissionButton, requesting && styles.buttonDisabled]}
            onPress={requestPermission}
            disabled={requesting}
          >
            {requesting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.permissionButtonText}>Bildirimlere izin ver</Text>
            )}
          </Pressable>
        )}
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
  permissionButton: {
    backgroundColor: colors.brand[600],
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    alignItems: 'center',
    marginTop: spacing.two,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
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
