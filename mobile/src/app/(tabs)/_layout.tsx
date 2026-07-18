import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { colors, fontFamily, radius, spacing } from '@/theme'

function BlockedScreen() {
  const { signOut } = useAuth()
  return (
    <View style={styles.blocked}>
      <Text style={styles.blockedText}>Bu uygulama doktorlar içindir.</Text>
      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutButtonText}>Çıkış</Text>
      </Pressable>
    </View>
  )
}

export default function TabsLayout() {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand[600]} />
      </View>
    )
  }

  if (!session) return <Redirect href="/login" />
  if (role !== 'doctor') return <BlockedScreen />

  return (
    <Tabs
      screenOptions={{
        headerTintColor: colors.slate[900],
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.slate[400],
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Bekleyen' }} />
      <Tabs.Screen name="history" options={{ title: 'Geçmiş' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ayarlar' }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.three,
    padding: spacing.four,
    backgroundColor: colors.surface,
  },
  blockedText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    color: colors.slate[700],
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: colors.brand[600],
    borderRadius: radius.md,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.two,
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.semibold,
  },
})
