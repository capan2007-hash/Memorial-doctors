import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

const extra = Constants.expoConfig?.extra ?? {}
const url = extra.supabaseUrl as string
const anon = extra.supabaseAnonKey as string

if (!url || !anon) {
  throw new Error('Supabase yapılandırması eksik: app.json > expo.extra.supabaseUrl/supabaseAnonKey')
}

export const supabase = createClient(url, anon, {
  auth: {
    // Web'de (ve SSR/node ortamında) AsyncStorage yerine varsayılan storage:
    // AsyncStorage node'da window.localStorage'a dokunup çöküyor.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
