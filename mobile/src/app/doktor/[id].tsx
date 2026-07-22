import { useEffect, useState } from 'react'
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router'
import { ChevronLeft, Save, Trash2 } from 'lucide-react-native'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Spinner } from '@/components/ui/Spinner'
import { ScopeEditor } from '@/features/admin/ScopeEditor'
import { useDoctorsFull, useUpdateDoctor } from '@/features/admin/useDoctors'
import { useManageUser } from '@/features/admin/useUsers'
import type { DoctorScope } from '@/features/profile/scope'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

export default function DoctorEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { role } = useAuth()
  const { colors } = useTheme()
  const doctors = useDoctorsFull()
  const update = useUpdateDoctor()
  const manage = useManageUser()

  const doctor = doctors.data?.find((d) => d.id === id)
  const canDelete = role === 'admin' || role === 'super_admin'

  const [title, setTitle] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')
  const [scopes, setScopes] = useState<DoctorScope[]>([])
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!doctor) return
    setTitle(doctor.title ?? '')
    setSpecialty(doctor.specialty ?? '')
    setBio(doctor.bio ?? '')
    setScopes(doctor.scopes)
    setIsActive(doctor.is_active)
  }, [doctor])

  if (role === 'doctor') return <Redirect href="/(tabs)" />

  if (doctors.isLoading) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.surface0 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Spinner />
      </View>
    )
  }

  if (!doctor) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.surface0 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Doktor bulunamadı.</Text>
        <Pressable onPress={() => router.back()} style={{ padding: spacing.two }}>
          <Text style={[styles.linkText, { color: colors.brandText }]}>Geri dön</Text>
        </Pressable>
      </View>
    )
  }

  const save = async () => {
    if (!scopes.length) {
      Alert.alert('Yetkinlik gerekli', 'En az bir yetkinlik seçilmelisiniz.')
      return
    }
    try {
      await update.mutateAsync({
        id: doctor.id,
        title: title.trim() || null,
        specialty: specialty.trim() || null,
        bio: bio.trim() || null,
        isActive,
        scopes,
      })
      Alert.alert('Kaydedildi', 'Doktor bilgileri güncellendi.')
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message)
    }
  }

  const confirmDelete = () => {
    if (!doctor.app_user_id) {
      Alert.alert('Silinemedi', 'Bu doktorun kullanıcı kaydı yok.')
      return
    }
    Alert.alert('Doktoru pasifleştir', `${title || 'Doktor'} pasife alınacak. Emin misiniz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Pasifleştir',
        style: 'destructive',
        onPress: async () => {
          try {
            await manage.mutateAsync({ userId: doctor.app_user_id!, action: 'delete_doctor' })
            Alert.alert('Pasifleştirildi', 'Doktor pasife alındı.')
            router.back()
          } catch (e) {
            Alert.alert('Silinemedi', (e as Error).message)
          }
        },
      },
    ])
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

        <Text style={[styles.title, { color: colors.textPrimary }]}>{title || 'Doktor'}</Text>

        {/* Aktiflik */}
        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Aktif</Text>
              <Text style={[styles.helper, { color: colors.textMuted }]}>Pasif doktora yeni talep atanmaz.</Text>
            </View>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>
        </View>

        {/* Profil */}
        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Profil</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Unvan</Text>
          <TextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="ör. Op. Dr." placeholderTextColor={colors.textMuted} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Branş</Text>
          <TextInput style={inputStyle} value={specialty} onChangeText={setSpecialty} placeholder="ör. Plastik Cerrahi" placeholderTextColor={colors.textMuted} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Biyografi</Text>
          <TextInput style={[inputStyle, styles.multiline]} value={bio} onChangeText={setBio} placeholder="Biyografi / CV" placeholderTextColor={colors.textMuted} multiline textAlignVertical="top" />
        </View>

        {/* Yetkinlikler */}
        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Yetkinlikler</Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>Bu tedaviler için yeni talepler bu doktora gönderilir.</Text>
          <ScopeEditor scopes={scopes} onChange={setScopes} />
          {!scopes.length && <Text style={[styles.warn, { color: colors.warningText }]}>En az bir yetkinlik seçilmeli.</Text>}
        </View>

        <Pressable onPress={save} disabled={update.isPending} accessibilityRole="button" style={[styles.primaryBtn, { backgroundColor: colors.brandFill }, update.isPending && styles.disabled]}>
          {update.isPending ? (
            <ActivityIndicator color={colors.brandOn} />
          ) : (
            <>
              <Save color={colors.brandOn} size={18} strokeWidth={1.75} />
              <Text style={[styles.primaryBtnText, { color: colors.brandOn }]}>Kaydet</Text>
            </>
          )}
        </Pressable>

        {canDelete && (
          <Pressable onPress={confirmDelete} disabled={manage.isPending} accessibilityRole="button" style={[styles.deleteBtn, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }, manage.isPending && styles.disabled]}>
            <Trash2 color={colors.dangerText} size={16} strokeWidth={1.75} />
            <Text style={[styles.deleteBtnText, { color: colors.dangerText }]}>Doktoru pasifleştir</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.two },
  errorText: { fontFamily: fontFamily.medium, fontSize: 15 },
  linkText: { fontFamily: fontFamily.semibold, fontSize: 14 },
  scrollContent: { padding: spacing.four, gap: spacing.three },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6 },
  backText: { fontFamily: fontFamily.medium, fontSize: 15 },
  title: { fontFamily: fontFamily.display, fontSize: 22 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.three, gap: spacing.one },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: fontFamily.medium, fontSize: 13, marginTop: spacing.one },
  helper: { fontFamily: fontFamily.regular, fontSize: 13 },
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
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    minHeight: 44,
  },
  deleteBtnText: { fontFamily: fontFamily.semibold, fontSize: 14 },
  disabled: { opacity: 0.5 },
})
