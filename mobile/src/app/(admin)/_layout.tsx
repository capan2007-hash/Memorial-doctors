import { Redirect, Tabs } from 'expo-router'
import { ClipboardList, Copy, LogOut, Settings, Stethoscope, Users } from 'lucide-react-native'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

/** Koordinatör grubuna erişimi olmayan (agent/sales) için basit engel ekranı. */
function BlockedScreen() {
  const { signOut } = useAuth()
  const { colors } = useTheme()
  return (
    <View style={[styles.blocked, { backgroundColor: colors.surface0 }]}>
      <Text style={[styles.blockedText, { color: colors.textSecondary }]}>Bu panel koordinatör ekibi içindir.</Text>
      <Pressable
        style={[styles.signOutButton, { backgroundColor: colors.brandFill }]}
        onPress={signOut}
        accessibilityRole="button"
      >
        <LogOut color={colors.brandOn} size={18} strokeWidth={1.75} />
        <Text style={[styles.signOutButtonText, { color: colors.brandOn }]}>Çıkış</Text>
      </Pressable>
    </View>
  )
}

export default function AdminTabsLayout() {
  const { session, role, loading } = useAuth()
  const { colors } = useTheme()

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.surface0 }]}>
        <ActivityIndicator color={colors.brandText} />
      </View>
    )
  }

  if (!session) return <Redirect href="/login" />
  if (role === 'doctor') return <Redirect href="/(tabs)" />
  const allowed = role === 'coordinator' || role === 'admin' || role === 'super_admin'
  if (!allowed) return <BlockedScreen />

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface1 },
        headerTitleStyle: { fontFamily: fontFamily.semibold, color: colors.textPrimary },
        headerTintColor: colors.textPrimary,
        tabBarActiveTintColor: colors.brandText,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface1,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.medium },
      }}
    >
      <Tabs.Screen
        name="talepler"
        options={{
          title: 'Talepler',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="mukerrer"
        options={{
          title: 'Mükerrer',
          tabBarIcon: ({ color, size }) => <Copy color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="doktorlar"
        options={{
          title: 'Doktorlar',
          tabBarIcon: ({ color, size }) => <Stethoscope color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="kullanicilar"
        options={{
          title: 'Kullanıcılar',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="ayarlar"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.three,
    padding: spacing.four,
  },
  blockedText: { fontFamily: fontFamily.medium, fontSize: 16, textAlign: 'center' },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    borderRadius: radius.md,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.two,
    minHeight: 44,
  },
  signOutButtonText: { fontFamily: fontFamily.semibold },
})
