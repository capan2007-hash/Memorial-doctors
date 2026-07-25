import { Redirect } from 'expo-router'
import { ChevronLeft, Lock, Mail, Plus } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { rtlIconStyle } from '@/lib/rtl'
import { fontFamily, radius, shadow, spacing } from '@/theme'

// Web sıfırlama sayfası — link tarayıcıda web /reset'i açar (mobilde ayrı sıfırlama ekranı yok).
const RESET_PASSWORD_REDIRECT_URL = 'https://medtriage.rememore.workers.dev/reset'

export default function LoginScreen() {
  const { session, role, loading, signIn } = useAuth()
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { colors } = useTheme()

  // Giriş / şifre-sıfırlama modu (bkz. web LoginPage.tsx aynı desen).
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetInfo, setResetInfo] = useState<string | null>(null)

  // Oturum varsa role göre yönlendir; rol henüz yükleniyorsa bekle (grup layout'ları da guard'lar).
  if (session && !loading) {
    if (role === 'coordinator' || role === 'admin' || role === 'super_admin') {
      return <Redirect href="/(admin)/talepler" />
    }
    return <Redirect href="/(tabs)" />
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    const { error: signInError } = await signIn(email, password)
    if (signInError) {
      setError(t('errors.signInFailed', { message: signInError }))
      setSubmitting(false)
    }
  }

  const openReset = () => {
    setResetEmail(email.trim())
    setResetError(null)
    setResetInfo(null)
    setMode('reset')
  }

  const backToLogin = () => {
    setMode('login')
    setResetError(null)
    setResetInfo(null)
  }

  const submitReset = async () => {
    const trimmed = resetEmail.trim()
    if (!trimmed) {
      setResetError(t('emailRequired'))
      return
    }
    setResetSubmitting(true)
    setResetError(null)
    try {
      await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo: RESET_PASSWORD_REDIRECT_URL })
      setResetInfo(t('resetInfo'))
    } catch {
      setResetError(t('resetError'))
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.surface0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.brandFill }]}>
          <View style={[styles.monogram, shadow.card]}>
            <Plus color={colors.brandOn} size={30} strokeWidth={2.25} />
          </View>
          <Text style={[styles.brandTitle, { color: colors.brandOn }]}>MedTriage</Text>
          <Text style={[styles.brandSubtitle, { color: colors.brandOn }]}>{t('tagline')}</Text>
        </View>

        {mode === 'login' ? (
          <View style={[styles.card, shadow.raised, { backgroundColor: colors.surface1 }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('signIn.title')}</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('signIn.email')}</Text>
            <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
              <Mail color={colors.textMuted} size={18} strokeWidth={1.75} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder={t('signIn.email')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('signIn.password')}</Text>
            <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
              <Lock color={colors.textMuted} size={18} strokeWidth={1.75} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder={t('signIn.password')}
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
            {error ? (
              <View style={[styles.alert, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}>
                <Text style={[styles.alertText, { color: colors.dangerText }]}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                shadow.card,
                { backgroundColor: colors.brandFill },
                submitting && styles.buttonDisabled,
                pressed && !submitting && { backgroundColor: colors.brandFillHover },
              ]}
              onPress={submit}
              disabled={submitting}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={colors.brandOn} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.brandOn }]}>{t('signIn.submit')}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={openReset}
              accessibilityRole="button"
              style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}
            >
              <Text style={[styles.linkText, { color: colors.brandText }]}>{t('forgot')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, shadow.raised, { backgroundColor: colors.surface1 }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('resetTitle')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('resetSubtitle')}</Text>

            {resetInfo ? (
              <View
                style={[styles.alert, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}
              >
                <Text style={[styles.alertText, { color: colors.successText }]}>{resetInfo}</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('signIn.email')}</Text>
                <View style={[styles.inputField, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
                  <Mail color={colors.textMuted} size={18} strokeWidth={1.75} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder={t('signIn.email')}
                    placeholderTextColor={colors.textMuted}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>
                {resetError ? (
                  <View
                    style={[styles.alert, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}
                  >
                    <Text style={[styles.alertText, { color: colors.dangerText }]}>{resetError}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    shadow.card,
                    { backgroundColor: colors.brandFill },
                    resetSubmitting && styles.buttonDisabled,
                    pressed && !resetSubmitting && { backgroundColor: colors.brandFillHover },
                  ]}
                  onPress={submitReset}
                  disabled={resetSubmitting}
                  accessibilityRole="button"
                >
                  {resetSubmitting ? (
                    <ActivityIndicator color={colors.brandOn} />
                  ) : (
                    <Text style={[styles.buttonText, { color: colors.brandOn }]}>{t('sendResetLink')}</Text>
                  )}
                </Pressable>
              </>
            )}

            <Pressable
              onPress={backToLogin}
              accessibilityRole="button"
              style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}
            >
              <ChevronLeft color={colors.brandText} size={16} strokeWidth={2} style={rtlIconStyle} />
              <Text style={[styles.linkText, { color: colors.brandText }]}>{t('backToLogin')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    paddingTop: spacing.six,
    paddingBottom: spacing.six + spacing.four,
    paddingHorizontal: spacing.four,
    alignItems: 'center',
    gap: spacing.two,
  },
  monogram: {
    height: 60,
    width: 60,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 28,
    fontFamily: fontFamily.display,
  },
  brandSubtitle: {
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    opacity: 0.88,
  },
  // Kartı hero'nun altına biner (negatif marginTop) — yükseltilmiş, üst köşeleri yuvarlak panel.
  card: {
    flex: 1,
    marginTop: -spacing.four,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.four,
    paddingTop: spacing.five,
    gap: spacing.one,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: fontFamily.display,
    marginBottom: spacing.two,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    marginTop: -spacing.one,
    marginBottom: spacing.one,
  },
  label: {
    fontFamily: fontFamily.medium,
    marginBottom: spacing.half,
    marginTop: spacing.one,
  },
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
  alert: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    marginTop: spacing.two,
  },
  alertText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.three,
    minHeight: 50,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: spacing.three,
    minHeight: 44,
    borderRadius: radius.sm,
  },
  linkButtonPressed: {
    opacity: 0.6,
  },
  linkText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
  },
})
