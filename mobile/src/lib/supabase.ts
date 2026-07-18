import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra ?? {}
const url = extra.supabaseUrl as string
const anon = extra.supabaseAnonKey as string

if (!url || !anon) {
  throw new Error('Supabase yapılandırması eksik: app.json > expo.extra.supabaseUrl/supabaseAnonKey')
}

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
