import { useEffect, useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router'
import { Camera, ChevronLeft, Plus, Save, Trash2, X } from 'lucide-react-native'
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

import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ScopeEditor } from '@/features/admin/ScopeEditor'
import {
  pickAndUploadDoctorPhoto,
  signDoctorPhoto,
  toWeightedWork,
  useDoctorsFull,
  useScoreEvents,
  useUpdateDoctor,
  type WeightedWork,
  type WeightedWorkLevel,
} from '@/features/admin/useDoctors'
import { useManageUser } from '@/features/admin/useUsers'
import type { DoctorScope } from '@/features/profile/scope'
import { monthlyNetChanges, netChangeInRange } from '@/domain/score'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, roleColors, spacing, type Palette } from '@/theme'

const LEVELS: { key: WeightedWorkLevel; label: string }[] = [
  { key: 'high', label: 'Yüksek' },
  { key: 'medium', label: 'Orta' },
  { key: 'low', label: 'Düşük' },
]

function WeightedWorkEditor({
  value,
  onChange,
  colors,
}: {
  value: WeightedWork
  onChange: (next: WeightedWork) => void
  colors: Palette
}) {
  const setItem = (i: number, patch: Partial<{ area: string; level: WeightedWorkLevel }>) => {
    const items = value.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    onChange({ ...value, items })
  }
  const removeItem = (i: number) => onChange({ ...value, items: value.items.filter((_, idx) => idx !== i) })
  const addItem = () => onChange({ ...value, items: [...value.items, { area: '', level: 'medium' }] })

  return (
    <View style={{ gap: spacing.two }}>
      {value.items.map((it, i) => (
        <View key={i} style={[styles.wwItem, { borderColor: colors.border, backgroundColor: colors.surface1 }]}>
          <View style={styles.wwItemTop}>
            <TextInput
              style={[styles.wwArea, { color: colors.textPrimary }]}
              value={it.area}
              onChangeText={(t) => setItem(i, { area: t })}
              placeholder="Alan (ör. Rinoplasti)"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable onPress={() => removeItem(i)} hitSlop={8} accessibilityRole="button">
              <X color={colors.textMuted} size={16} strokeWidth={1.75} />
            </Pressable>
          </View>
          <View style={styles.chipWrap}>
            {LEVELS.map((lv) => {
              const selected = it.level === lv.key
              return (
                <Pressable
                  key={lv.key}
                  onPress={() => setItem(i, { level: lv.key })}
                  style={[
                    styles.lvChip,
                    selected
                      ? { backgroundColor: colors.brandFill, borderColor: colors.brandFill }
                      : { backgroundColor: colors.surface2, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.lvChipText, { color: selected ? colors.brandOn : colors.textSecondary }]}>
                    {lv.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
      <Pressable onPress={addItem} accessibilityRole="button" style={[styles.addBtn, { borderColor: colors.border }]}>
        <Plus color={colors.textSecondary} size={15} strokeWidth={1.75} />
        <Text style={[styles.addBtnText, { color: colors.textSecondary }]}>Alan ekle</Text>
      </Pressable>
      <TextInput
        style={[styles.input, styles.multiline, { backgroundColor: colors.surface1, borderColor: colors.border, color: colors.textPrimary }]}
        value={value.note}
        onChangeText={(t) => onChange({ ...value, note: t })}
        placeholder="Not (opsiyonel)"
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
      />
    </View>
  )
}

function ScoreHistory({ doctorId, colors }: { doctorId: string; colors: Palette }) {
  const events = useScoreEvents(doctorId)
  const rows = events.data ?? []
  const total = useMemo(() => netChangeInRange(rows, '1970-01-01T00:00:00.000Z', new Date().toISOString()), [rows])
  const monthly = useMemo(() => monthlyNetChanges(rows), [rows])
  const success = roleColors(colors, 'success')
  const danger = roleColors(colors, 'danger')
  const maxAbs = Math.max(1, ...monthly.map((m) => Math.abs(m.net)))

  if (events.isLoading) return <Spinner />

  return (
    <View style={{ gap: spacing.two }}>
      <View style={styles.scoreTotals}>
        <View style={[styles.totalChip, { backgroundColor: success.bg }]}>
          <Text style={[styles.totalValue, { color: success.text }]}>{total.positive}</Text>
          <Text style={[styles.totalLabel, { color: success.text }]}>Zamanında</Text>
        </View>
        <View style={[styles.totalChip, { backgroundColor: danger.bg }]}>
          <Text style={[styles.totalValue, { color: danger.text }]}>{total.negative}</Text>
          <Text style={[styles.totalLabel, { color: danger.text }]}>Hedef dışı</Text>
        </View>
      </View>
      <View style={styles.barRow}>
        {monthly.map((m) => {
          const h = Math.round((Math.abs(m.net) / maxAbs) * 40)
          const pos = m.net >= 0
          return (
            <View key={m.key} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(2, h), backgroundColor: pos ? success.text : danger.text },
                  ]}
                />
              </View>
              <Text style={[styles.barNet, { color: colors.textSecondary }]}>{m.net > 0 ? `+${m.net}` : m.net}</Text>
              <Text style={[styles.barLabel, { color: colors.textMuted }]}>{m.label.slice(0, 3)}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

export default function DoctorEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { role, tenantId } = useAuth()
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
  const [weightedWork, setWeightedWork] = useState<WeightedWork>({ items: [], note: '' })
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoSigned, setPhotoSigned] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!doctor) return
    setTitle(doctor.title ?? '')
    setSpecialty(doctor.specialty ?? '')
    setBio(doctor.bio ?? '')
    setScopes(doctor.scopes)
    setIsActive(doctor.is_active)
    setWeightedWork(toWeightedWork(doctor.weighted_work))
    setPhotoUrl(doctor.photo_url)
  }, [doctor])

  useEffect(() => {
    let cancelled = false
    if (photoUrl) {
      signDoctorPhoto(photoUrl)
        .then((u) => !cancelled && setPhotoSigned(u))
        .catch(() => !cancelled && setPhotoSigned(null))
    } else {
      setPhotoSigned(null)
    }
    return () => {
      cancelled = true
    }
  }, [photoUrl])

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

  const changePhoto = async () => {
    if (!tenantId) return
    setUploading(true)
    try {
      const path = await pickAndUploadDoctorPhoto(tenantId, doctor.id)
      if (path) setPhotoUrl(path) // Kaydet ile doctor.photo_url'e yazılır
    } catch (e) {
      Alert.alert('Yüklenemedi', (e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!scopes.length) {
      Alert.alert('Yetkinlik gerekli', 'En az bir yetkinlik seçmelisiniz.')
      return
    }
    try {
      await update.mutateAsync({
        id: doctor.id,
        title: title.trim() || null,
        specialty: specialty.trim() || null,
        bio: bio.trim() || null,
        isActive,
        weightedWork,
        photoUrl,
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
  const card = [styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]

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

        {/* Foto + isim */}
        <View style={styles.photoRow}>
          {photoSigned ? (
            <Image source={{ uri: photoSigned }} style={styles.photo} contentFit="cover" />
          ) : (
            <Avatar name={title || 'Doktor'} size={64} />
          )}
          <View style={styles.photoInfo}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title || 'Doktor'}</Text>
            <Pressable onPress={changePhoto} disabled={uploading} accessibilityRole="button" style={styles.photoBtn} hitSlop={6}>
              {uploading ? (
                <ActivityIndicator color={colors.brandText} size="small" />
              ) : (
                <>
                  <Camera color={colors.brandText} size={15} strokeWidth={1.75} />
                  <Text style={[styles.photoBtnText, { color: colors.brandText }]}>
                    {photoSigned ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Aktiflik */}
        <View style={card}>
          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Aktif</Text>
              <Text style={[styles.helper, { color: colors.textMuted }]}>Pasif doktora yeni talep atanmaz.</Text>
            </View>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>
        </View>

        {/* Profil */}
        <View style={card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Profil</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Unvan</Text>
          <TextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="ör. Op. Dr." placeholderTextColor={colors.textMuted} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Branş</Text>
          <TextInput style={inputStyle} value={specialty} onChangeText={setSpecialty} placeholder="ör. Plastik Cerrahi" placeholderTextColor={colors.textMuted} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Biyografi</Text>
          <TextInput style={[inputStyle, styles.multiline]} value={bio} onChangeText={setBio} placeholder="Biyografi / CV" placeholderTextColor={colors.textMuted} multiline textAlignVertical="top" />
        </View>

        {/* Yetkinlikler */}
        <View style={card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Yetkinlikler</Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>Bu tedaviler için yeni talepler bu doktora gönderilir.</Text>
          <ScopeEditor scopes={scopes} onChange={setScopes} />
          {!scopes.length && <Text style={[styles.warn, { color: colors.warningText }]}>En az bir yetkinlik seçilmeli.</Text>}
        </View>

        {/* Ağırlıklı işler */}
        <View style={card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Ağırlıklı işler</Text>
          <WeightedWorkEditor value={weightedWork} onChange={setWeightedWork} colors={colors} />
        </View>

        {/* Skor geçmişi */}
        <View style={card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Skor geçmişi</Text>
          <ScoreHistory doctorId={doctor.id} colors={colors} />
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
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.three },
  photo: { width: 64, height: 64, borderRadius: radius.full },
  photoInfo: { flex: 1, gap: spacing.half },
  title: { fontFamily: fontFamily.display, fontSize: 22 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.half },
  photoBtnText: { fontFamily: fontFamily.medium, fontSize: 13 },
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
  multiline: { minHeight: 72 },
  warn: { fontFamily: fontFamily.medium, fontSize: 12, marginTop: spacing.half },
  wwItem: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, padding: spacing.two, gap: spacing.one },
  wwItemTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  wwArea: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.one },
  lvChip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.full, paddingHorizontal: spacing.two, paddingVertical: 4 },
  lvChipText: { fontFamily: fontFamily.medium, fontSize: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.half, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: radius.sm, paddingVertical: spacing.one + 2 },
  addBtnText: { fontFamily: fontFamily.medium, fontSize: 13 },
  scoreTotals: { flexDirection: 'row', gap: spacing.two },
  totalChip: { flex: 1, alignItems: 'center', borderRadius: radius.sm, paddingVertical: spacing.two },
  totalValue: { fontFamily: fontFamily.display, fontSize: 20, fontVariant: ['tabular-nums'] },
  totalLabel: { fontFamily: fontFamily.regular, fontSize: 12 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.one },
  barCol: { alignItems: 'center', flex: 1, gap: 2 },
  barTrack: { height: 44, justifyContent: 'flex-end' },
  bar: { width: 16, borderRadius: 3 },
  barNet: { fontFamily: fontFamily.medium, fontSize: 11, fontVariant: ['tabular-nums'] },
  barLabel: { fontFamily: fontFamily.regular, fontSize: 10 },
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
