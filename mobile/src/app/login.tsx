import { Redirect } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

export default function LoginScreen() {
  const { session, role, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { colors } = useTheme()

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
      setError('Giriş başarısız: ' + signInError)
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.surface0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.hero, { backgroundColor: colors.brandFill }]}>
        <View style={styles.monogram}>
          <Plus color={colors.brandOn} size={30} strokeWidth={2.25} />
        </View>
        <Text style={[styles.brandTitle, { color: colors.brandOn }]}>MedTriage</Text>
        <Text style={[styles.brandSubtitle, { color: colors.brandOn }]}>
          Estetik cerrahi talep yönetimi &amp; triyaj
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Giriş</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>E-posta</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.surface1, borderColor: colors.border, color: colors.textPrimary },
          ]}
          placeholder="E-posta"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Şifre</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.surface1, borderColor: colors.border, color: colors.textPrimary },
          ]}
          placeholder="Şifre"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={[styles.error, { color: colors.dangerText }]}>{error}</Text> : null}

        <Pressable
          style={[styles.button, { backgroundColor: colors.brandFill }, submitting && styles.buttonDisabled]}
          onPress={submit}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color={colors.brandOn} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.brandOn }]}>Giriş</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    paddingVertical: spacing.six,
    paddingHorizontal: spacing.four,
    alignItems: 'center',
    gap: spacing.two,
  },
  monogram: {
    height: 56,
    width: 56,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
    opacity: 0.85,
  },
  card: {
    flex: 1,
    padding: spacing.four,
    justifyContent: 'center',
    gap: spacing.one,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: fontFamily.display,
    marginBottom: spacing.two,
  },
  label: {
    fontFamily: fontFamily.medium,
    marginBottom: spacing.half,
    marginTop: spacing.one,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    fontFamily: fontFamily.regular,
    minHeight: 48,
  },
  error: {
    fontFamily: fontFamily.regular,
    marginTop: spacing.one,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.three,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
})
