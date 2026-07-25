import { Redirect, Tabs } from 'expo-router'
import { BarChart3, Clock, Inbox, LogOut, Settings, UserCircle } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

function BlockedScreen() {
  const { signOut } = useAuth()
  const { colors } = useTheme()
  const { t } = useTranslation('common')
  return (
    <View style={[styles.blocked, { backgroundColor: colors.surface0 }]}>
      <Text style={[styles.blockedText, { color: colors.textSecondary }]}>{t('doctorTabs.blocked')}</Text>
      <Pressable
        style={[styles.signOutButton, { backgroundColor: colors.brandFill }]}
        onPress={signOut}
        accessibilityRole="button"
      >
        <LogOut color={colors.brandOn} size={18} strokeWidth={1.75} />
        <Text style={[styles.signOutButtonText, { color: colors.brandOn }]}>{t('actions.signOut')}</Text>
      </Pressable>
    </View>
  )
}

export default function TabsLayout() {
  const { session, role, loading } = useAuth()
  const { colors } = useTheme()
  const { t } = useTranslation('common')

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.surface0 }]}>
        <ActivityIndicator color={colors.brandText} />
      </View>
    )
  }

  if (!session) return <Redirect href="/login" />
  if (role === 'coordinator' || role === 'admin' || role === 'super_admin') return <Redirect href="/(admin)/talepler" />
  if (role !== 'doctor') return <BlockedScreen />

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
        name="index"
        options={{
          title: t('doctorTabs.tabs.pending'),
          tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('doctorTabs.tabs.history'),
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('doctorTabs.tabs.dashboard'),
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('doctorTabs.tabs.profile'),
          tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('doctorTabs.tabs.settings'),
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.three,
    padding: spacing.four,
  },
  blockedText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    textAlign: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    borderRadius: radius.md,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.two,
    minHeight: 44,
  },
  signOutButtonText: {
    fontFamily: fontFamily.semibold,
  },
})
