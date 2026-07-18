import { Redirect } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { colors, fontFamily, radius, spacing } from '@/theme'

export default function LoginScreen() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Redirect href="/(tabs)" />

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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <View style={styles.monogram}>
          <Text style={styles.monogramText}>+</Text>
        </View>
        <Text style={styles.brandTitle}>MedTriage</Text>
        <Text style={styles.brandSubtitle}>Estetik cerrahi talep yönetimi &amp; triyaj</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Giriş</Text>

        <Text style={styles.label}>E-posta</Text>
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor={colors.slate[400]}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Text style={styles.label}>Şifre</Text>
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor={colors.slate[400]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Giriş</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  hero: {
    backgroundColor: colors.brand[700],
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
  monogramText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: fontFamily.semibold,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: fontFamily.display,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontFamily: fontFamily.regular,
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
    color: colors.slate[900],
    marginBottom: spacing.two,
  },
  label: {
    fontFamily: fontFamily.medium,
    color: colors.slate[700],
    marginBottom: spacing.half,
    marginTop: spacing.one,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: radius.md,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.two,
    fontFamily: fontFamily.regular,
    color: colors.slate[900],
    backgroundColor: colors.card,
  },
  error: {
    color: colors.danger[600],
    fontFamily: fontFamily.regular,
    marginTop: spacing.one,
  },
  button: {
    backgroundColor: colors.brand[600],
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.three,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
})
