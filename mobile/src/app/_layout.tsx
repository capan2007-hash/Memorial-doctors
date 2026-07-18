import { Fraunces_600SemiBold, useFonts as useFrauncesFonts } from '@expo-google-fonts/fraunces'
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts as useJakartaFonts,
} from '@expo-google-fonts/plus-jakarta-sans'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'

import { AuthProvider, useAuth } from '@/lib/auth'
import { useNotificationDeepLink, usePushSetup } from '@/features/push/usePushRegistration'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient()

// useAuth() AuthProvider içinde çağrılmalı; push kaydı + bildirim yönlendirmesi
// bu yüzden ayrı bir iç bileşende yaşar (RootLayout'ta doğrudan değil).
function RootNavigator() {
  const { doctorId, tenantId } = useAuth()
  usePushSetup(doctorId, tenantId)
  useNotificationDeepLink()

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}

export default function RootLayout() {
  const [frauncesLoaded] = useFrauncesFonts({ Fraunces_600SemiBold })
  const [jakartaLoaded] = useJakartaFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  })
  const fontsLoaded = frauncesLoaded && jakartaLoaded

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  )
}
