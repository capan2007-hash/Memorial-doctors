import { useState } from 'react'
import { Redirect, Stack, router } from 'expo-router'
import { Briefcase, ChevronLeft, FileText, Lock, Mail, Stethoscope, User, UserPlus } from 'lucide-react-native'
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

import { ScopeEditor } from '@/features/admin/ScopeEditor'
import { useCreateDoctor } from '@/features/admin/useDoctors'
import type { DoctorScope } from '@/features/profile/scope'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { rtlIconStyle } from '@/lib/rtl'
import { fontFamily, radius, shadow, spacing } from '@/theme'

export default function NewDoctorScreen() {
  const { role } = useAuth()
  const { colors } = useTheme()
  const { t } = useTranslation('doctors')
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
      Alert.alert(t('new.alerts.missingFieldsTitle'), t('new.alerts.missingFieldsMessage'))
      return
    }
    if (!scopes.length) {
      Alert.alert(t('new.alerts.scopeRequiredTitle'), t('new.alerts.scopeRequiredMessage'))
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
      Alert.alert(t('new.alerts.createdTitle'), t('new.alerts.createdMessage', { name: fullName.trim() }))
      router.back()
    } catch (e) {
      Alert.alert(t('new.alerts.createFailedTitle'), (e as Error).message)
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
          <Text style={[styles.backText, { color: colors.textSecondary }]}>{t('backLabel')}</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('new.title')}</Text>

        <View style={[styles.card, shadow.raised, { backgroundColor: colors.surface1 }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('new.account.title')}</Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('new.account.emailLabel')}</Text>
          <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <Mail color={colors.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={email}
              onChangeText={setEmail}
              placeholder={t('new.account.emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('new.account.passwordLabel')}</Text>
          <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <Lock color={colors.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t('new.account.passwordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('new.account.fullNameLabel')}</Text>
          <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <User color={colors.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('new.account.fullNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <View style={[styles.card, shadow.raised, { backgroundColor: colors.surface1 }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('profile.title')}</Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('profile.titleLabel')}</Text>
          <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <Briefcase color={colors.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={title}
              onChangeText={setTitle}
              placeholder={t('profile.titlePlaceholder')}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('profile.specialtyLabel')}</Text>
          <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <Stethoscope color={colors.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={specialty}
              onChangeText={setSpecialty}
              placeholder={t('profile.specialtyPlaceholder')}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('profile.bioLabel')}</Text>
          <View style={[styles.inputField, styles.multilineField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
            <FileText color={colors.textMuted} size={18} strokeWidth={1.75} style={styles.multilineIcon} />
            <TextInput
              style={[styles.input, styles.multiline, { color: colors.textPrimary }]}
              value={bio}
              onChangeText={setBio}
              placeholder={t('profile.bioPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={[styles.card, shadow.raised, { backgroundColor: colors.surface1 }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('scopes.title')}</Text>
          <ScopeEditor scopes={scopes} onChange={setScopes} />
          {!scopes.length && <Text style={[styles.warn, { color: colors.warningText }]}>{t('scopes.warnMin')}</Text>}
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
              <Text style={[styles.primaryBtnText, { color: colors.brandOn }]}>{t('new.submit')}</Text>
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
  multilineField: { alignItems: 'flex-start', paddingVertical: spacing.two },
  multilineIcon: { marginTop: 2 },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    paddingVertical: spacing.two,
  },
  multiline: { minHeight: 76, paddingVertical: 0 },
  warn: { fontFamily: fontFamily.medium, fontSize: 12, marginTop: spacing.half },
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
