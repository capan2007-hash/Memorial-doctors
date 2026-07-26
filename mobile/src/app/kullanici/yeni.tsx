import { useMemo, useState } from 'react'
import { Redirect, Stack, router } from 'expo-router'
import { Check, ChevronLeft, Lock, Mail, Phone, User, UserPlus } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
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

import { creatableRoles } from '@/domain/userRoles'
import { useCreateUser } from '@/features/admin/useUsers'
import { useAuth, type Role } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { rtlIconStyle } from '@/lib/rtl'
import { fontFamily, radius, shadow, spacing } from '@/theme'

export default function NewUserScreen() {
  const { role } = useAuth()
  const { colors } = useTheme()
  const { t } = useTranslation('admin')
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
      Alert.alert(t('newUser.alerts.missingFieldsTitle'), t('newUser.alerts.missingFieldsMessage'))
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
      Alert.alert(t('newUser.alerts.createdTitle'), t('newUser.alerts.createdMessage', { name: fullName.trim() }))
      router.back()
    } catch (e) {
      Alert.alert(t('newUser.alerts.createFailedTitle'), (e as Error).message)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.surface0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.back} hitSlop={8}>
          <ChevronLeft color={colors.textSecondary} size={22} strokeWidth={1.75} style={rtlIconStyle} />
          <Text style={[styles.backText, { color: colors.textSecondary }]}>{t('newUser.backLabel')}</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('newUser.title')}</Text>

        <View style={[styles.card, shadow.raised, { backgroundColor: colors.surface1 }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('newUser.emailLabel')}</Text>
          <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <Mail color={colors.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={email}
              onChangeText={setEmail}
              placeholder={t('newUser.emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('newUser.passwordLabel')}</Text>
          <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <Lock color={colors.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t('newUser.passwordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('newUser.fullNameLabel')}</Text>
          <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <User color={colors.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('newUser.fullNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('newUser.phoneLabel')}</Text>
          <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <Phone color={colors.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('newUser.phonePlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={[styles.card, shadow.raised, { backgroundColor: colors.surface1 }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('newUser.roleTitle')}</Text>
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
                      : { backgroundColor: colors.surface0, borderColor: colors.border },
                  ]}
                >
                  {selected && <Check color={colors.brandOn} size={13} strokeWidth={2} />}
                  <Text style={[styles.chipText, { color: selected ? colors.brandOn : colors.textSecondary }]}>{t(`roles.${r}`)}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Pressable
          onPress={submit}
          disabled={create.isPending}
          accessibilityRole="button"
          style={[styles.primaryBtn, shadow.card, { backgroundColor: colors.brandFill }, create.isPending && styles.disabled]}
        >
          {create.isPending ? (
            <ActivityIndicator color={colors.brandOn} />
          ) : (
            <>
              <UserPlus color={colors.brandOn} size={18} strokeWidth={1.75} />
              <Text style={[styles.primaryBtnText, { color: colors.brandOn }]}>{t('newUser.submit')}</Text>
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
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginStart: -6 },
  backText: { fontFamily: fontFamily.medium, fontSize: 15 },
  title: { fontFamily: fontFamily.display, fontSize: 22 },
  card: { borderRadius: radius.lg, padding: spacing.three, gap: spacing.one },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 16, marginBottom: spacing.half },
  label: { fontFamily: fontFamily.medium, fontSize: 13, marginTop: spacing.one },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.three,
    minHeight: 50,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    paddingVertical: spacing.two,
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
    minHeight: 50,
  },
  primaryBtnText: { fontFamily: fontFamily.semibold, fontSize: 15 },
  disabled: { opacity: 0.5 },
})
