import { useMemo, useState } from 'react'
import { Redirect, Stack, router } from 'expo-router'
import { Check, ChevronLeft, UserPlus } from 'lucide-react-native'
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

import { creatableRoles, roleLabel } from '@/domain/userRoles'
import { useCreateUser } from '@/features/admin/useUsers'
import { useAuth, type Role } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

export default function NewUserScreen() {
  const { role } = useAuth()
  const { colors } = useTheme()
  const create = useCreateUser()

  const options = useMemo(() => (role ? creatableRoles(role) : []), [role])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role | null>(options[0] ?? null)

  if (role === 'doctor') return <Redirect href="/(tabs)" />
  if (options.length === 0) return <Redirect href="/(admin)/kullanicilar" />

  const submit = async () => {
    if (!email.trim() || !password.trim() || !fullName.trim() || !selectedRole) {
      Alert.alert('Eksik bilgi', 'E-posta, şifre, ad ve rol zorunludur.')
      return
    }
    try {
      await create.mutateAsync({
        email: email.trim(),
        password: password.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        role: selectedRole,
      })
      Alert.alert('Kullanıcı eklendi', `${fullName.trim()} oluşturuldu.`)
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
          <Text style={[styles.backText, { color: colors.textSecondary }]}>Kullanıcılar</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Yeni Kullanıcı</Text>

        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>E-posta</Text>
          <TextInput style={inputStyle} value={email} onChangeText={setEmail} placeholder="kullanici@klinik.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Geçici şifre</Text>
          <TextInput style={inputStyle} value={password} onChangeText={setPassword} placeholder="Geçici şifre" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Ad Soyad</Text>
          <TextInput style={inputStyle} value={fullName} onChangeText={setFullName} placeholder="Ad Soyad" placeholderTextColor={colors.textMuted} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Telefon (opsiyonel)</Text>
          <TextInput style={inputStyle} value={phone} onChangeText={setPhone} placeholder="+90…" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Rol</Text>
          <View style={styles.chipWrap}>
            {options.map((r) => {
              const selected = selectedRole === r
              return (
                <Pressable
                  key={r}
                  onPress={() => setSelectedRole(r)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: colors.brandFill, borderColor: colors.brandFill }
                      : { backgroundColor: colors.surface1, borderColor: colors.border },
                  ]}
                >
                  {selected && <Check color={colors.brandOn} size={13} strokeWidth={2} />}
                  <Text style={[styles.chipText, { color: selected ? colors.brandOn : colors.textSecondary }]}>{roleLabel(r)}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Pressable onPress={submit} disabled={create.isPending} accessibilityRole="button" style={[styles.primaryBtn, { backgroundColor: colors.brandFill }, create.isPending && styles.disabled]}>
          {create.isPending ? (
            <ActivityIndicator color={colors.brandOn} />
          ) : (
            <>
              <UserPlus color={colors.brandOn} size={18} strokeWidth={1.75} />
              <Text style={[styles.primaryBtnText, { color: colors.brandOn }]}>Kullanıcı oluştur</Text>
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.one, marginTop: spacing.half },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.one,
    minHeight: 40,
  },
  chipText: { fontFamily: fontFamily.medium, fontSize: 13 },
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
