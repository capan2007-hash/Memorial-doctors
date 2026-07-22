import { useState } from 'react'
import { Redirect, Stack, router } from 'expo-router'
import { ChevronLeft, UserPlus } from 'lucide-react-native'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ScopeEditor } from '@/features/admin/ScopeEditor'
import { useCreateDoctor } from '@/features/admin/useDoctors'
import type { DoctorScope } from '@/features/profile/scope'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

export default function NewDoctorScreen() {
  const { role } = useAuth()
  const { colors } = useTheme()
  const create = useCreateDoctor()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')
  const [scopes, setScopes] = useState<DoctorScope[]>([])

  if (role === 'doctor') return <Redirect href="/(tabs)" />

  const submit = async () => {
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      Alert.alert('Eksik bilgi', 'E-posta, şifre ve ad zorunludur.')
      return
    }
    if (!scopes.length) {
      Alert.alert('Yetkinlik gerekli', 'En az bir yetkinlik seçmelisiniz.')
      return
    }
    try {
      await create.mutateAsync({
        email: email.trim(),
        password: password.trim(),
        fullName: fullName.trim(),
        title: title.trim(),
        specialty: specialty.trim(),
        bio: bio.trim(),
        weightedWork: { items: [], note: '' },
        scopes,
      })
      Alert.alert('Doktor eklendi', `${fullName.trim()} oluşturuldu.`)
      router.back()
    } catch (e) {
      Alert.alert('Eklenemedi', (e as Error).message)
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface1, borderColor: colors.border, color: colors.textPrimary },
  ]

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.surface0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.back} hitSlop={8}>
          <ChevronLeft color={colors.textSecondary} size={22} strokeWidth={1.75} />
          <Text style={[styles.backText, { color: colors.textSecondary }]}>Doktorlar</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Yeni Doktor</Text>

        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Hesap</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>E-posta</Text>
          <TextInput style={inputStyle} value={email} onChangeText={setEmail} placeholder="doktor@klinik.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Geçici şifre</Text>
          <TextInput style={inputStyle} value={password} onChangeText={setPassword} placeholder="Geçici şifre" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Ad Soyad</Text>
          <TextInput style={inputStyle} value={fullName} onChangeText={setFullName} placeholder="Ad Soyad" placeholderTextColor={colors.textMuted} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Profil</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Unvan</Text>
          <TextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="ör. Op. Dr." placeholderTextColor={colors.textMuted} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Branş</Text>
          <TextInput style={inputStyle} value={specialty} onChangeText={setSpecialty} placeholder="ör. Plastik Cerrahi" placeholderTextColor={colors.textMuted} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Biyografi</Text>
          <TextInput style={[inputStyle, styles.multiline]} value={bio} onChangeText={setBio} placeholder="Biyografi / CV" placeholderTextColor={colors.textMuted} multiline textAlignVertical="top" />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Yetkinlikler</Text>
          <ScopeEditor scopes={scopes} onChange={setScopes} />
          {!scopes.length && <Text style={[styles.warn, { color: colors.warningText }]}>En az bir yetkinlik seçilmeli.</Text>}
        </View>

        <Pressable onPress={submit} disabled={create.isPending} accessibilityRole="button" style={[styles.primaryBtn, { backgroundColor: colors.brandFill }, create.isPending && styles.disabled]}>
          {create.isPending ? (
            <ActivityIndicator color={colors.brandOn} />
          ) : (
            <>
              <UserPlus color={colors.brandOn} size={18} strokeWidth={1.75} />
              <Text style={[styles.primaryBtnText, { color: colors.brandOn }]}>Doktoru oluştur</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { padding: spacing.four, gap: spacing.three },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6 },
  backText: { fontFamily: fontFamily.medium, fontSize: 15 },
  title: { fontFamily: fontFamily.display, fontSize: 22 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.three, gap: spacing.one },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 16 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, marginTop: spacing.one },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.two,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    minHeight: 44,
  },
  multiline: { minHeight: 88 },
  warn: { fontFamily: fontFamily.medium, fontSize: 12, marginTop: spacing.half },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    minHeight: 48,
  },
  primaryBtnText: { fontFamily: fontFamily.semibold, fontSize: 15 },
  disabled: { opacity: 0.5 },
})
