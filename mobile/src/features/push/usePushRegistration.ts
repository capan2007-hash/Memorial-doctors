// M6a Task 6b: doktor cihazını Expo push token'ıyla kaydeder/kaldırır ve
// bildirime dokunmayı Talep Detayı'na yönlendirir.
// Not: Expo Go (SDK 53+) uzak push token'ı desteklemez — getExpoPushTokenAsync
// bu ortamda ve projectId eksik dev/prod build'lerde fırlatabilir; hepsi
// yakalanır ve null döner, uygulama asla çökmez (bkz. tasarım doc §3 kısıt).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'

import { supabase } from '@/lib/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined'

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    })
  } catch {
    // Kanal oluşturulamazsa bildirim yine de varsayılan davranışla gelir.
  }
}

async function getExpoPushToken(): Promise<string | null> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    return data ?? null
  } catch (e) {
    console.warn('[push] token alınamadı (Expo Go veya projectId eksik olabilir):', e)
    return null
  }
}

/** Doktor girişinden sonra çağrılır: izin varsa/verilirse token alır ve upsert eder. Hata fırlatmaz. */
export async function registerForPush(doctorId: string, tenantId: string): Promise<void> {
  try {
    let { status } = await Notifications.getPermissionsAsync()
    if (status === 'undetermined') {
      ;({ status } = await Notifications.requestPermissionsAsync())
    }
    if (status !== 'granted') return

    await ensureAndroidChannel()

    const token = await getExpoPushToken()
    if (!token) return

    const { error } = await supabase.from('push_token').upsert(
      {
        tenant_id: tenantId,
        doctor_id: doctorId,
        expo_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'doctor_id,expo_token' }
    )
    if (error) console.warn('[push] token kaydedilemedi:', error.message)
  } catch (e) {
    console.warn('[push] kayıt başarısız:', e)
  }
}

/** Çıkıştan HEMEN ÖNCE (session hâlâ geçerliyken) çağrılır: bu cihazın token'ını siler. */
export async function unregisterPush(doctorId: string): Promise<void> {
  try {
    const token = await getExpoPushToken()
    if (!token) return
    await supabase.from('push_token').delete().eq('doctor_id', doctorId).eq('expo_token', token)
  } catch {
    // Çıkış akışını asla bloklamaz/bozmaz — token silinemezse sessizce yutulur.
  }
}

/**
 * Ayarlar ekranı ve kök layout için: mount olduğunda (doctorId/tenantId
 * mevcutsa) sessizce kayıt dener, izin durumunu döner. `refresh` izin
 * durumunu yeniden okur (örn. "Bildirimlere izin ver" düğmesinden sonra).
 */
export function usePushSetup(doctorId?: string | null, tenantId?: string | null) {
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus | null>(null)
  const registeredForRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync()
    setPermissionStatus(status as PushPermissionStatus)
    return status
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!doctorId || !tenantId) return
    if (registeredForRef.current === doctorId) return // aynı doktor için tekrar deneme
    registeredForRef.current = doctorId
    registerForPush(doctorId, tenantId).finally(refresh)
  }, [doctorId, tenantId, refresh])

  return { permissionStatus, refresh }
}

/**
 * Kök layout'ta bir kez kullanılır: bildirime dokunma (ön/arka plan) ve
 * soğuk başlangıç (uygulama bildirimle açıldıysa) durumlarında
 * Talep Detayı'na yönlendirir.
 */
export function useNotificationDeepLink() {
  const router = useRouter()

  useEffect(() => {
    // Web'de uzak bildirim API'leri yok; deep link dinleyicileri yalnız native.
    if (Platform.OS === 'web') return

    const navigateFromResponse = (response: Notifications.NotificationResponse | null) => {
      const requestId = response?.notification.request.content.data?.requestId as string | undefined
      if (!requestId) return
      router.push({ pathname: '/request/[id]', params: { id: requestId } })
    }

    // Soğuk başlangıç: uygulama bir bildirime dokunularak açıldıysa.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        navigateFromResponse(response)
        if (response) Notifications.clearLastNotificationResponseAsync().catch(() => {})
      })
      .catch(() => {})

    // Uygulama açıkken/arka plandayken bildirime dokunma.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromResponse(response)
    })
    return () => subscription.remove()
  }, [router])
}
