import { useEffect, useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { Check, Save, UserCircle } from 'lucide-react-native'
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

import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing, type Palette } from '@/theme'
import {
  hasScope,
  toggleScope,
  useCategories,
  useOwnDoctor,
  useSetOwnScopes,
  useSubcategories,
  useUpdateOwnProfile,
  type CategoryRow,
  type DoctorScope,
} from '@/features/profile/useOwnProfile'

/** Doktor fotoğrafı: depo yolu imzalanır (photos bucket); yoksa baş harf rozeti. Salt görüntü. */
function ProfileAvatar({ photoUrl, name, colors }: { photoUrl: string | null; name: string; colors: Palette }) {
  const { t } = useTranslation('profile')
  const signed = useQuery({
    queryKey: ['doctor-photo-signed', photoUrl],
    enabled: !!photoUrl,
    queryFn: async () => {
      const { data } = await supabase.storage.from('photos').createSignedUrl(photoUrl!, 300)
      return data?.signedUrl ?? null
    },
  })
  const initial = name.trim().charAt(0).toUpperCase() || 'D'
  if (photoUrl && signed.data) {
    return (
      <Image
        source={{ uri: signed.data }}
        style={styles.avatar}
        contentFit="cover"
        accessibilityLabel={t('photoLabel')}
      />
    )
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
      <Text style={[styles.avatarInitial, { color: colors.textSecondary }]}>{initial}</Text>
    </View>
  )
}

/** Tek kategori: alt kırılım yoksa kategori çipi; varsa alt kırılım çip listesi (DoctorAdmin deseni). */
function CategoryScopeRow({
  category,
  scopes,
  onChange,
  colors,
}: {
  category: CategoryRow
  scopes: DoctorScope[]
  onChange: (next: DoctorScope[]) => void
  colors: Palette
}) {
  const { t } = useTranslation('profile')
  const subs = useSubcategories(category.has_subcategories ? category.id : undefined)

  if (!category.has_subcategories) {
    const selected = hasScope(scopes, category.id, null)
    return (
      <ScopeChip
        label={category.name}
        selected={selected}
        onPress={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: null }))}
        colors={colors}
      />
    )
  }

  return (
    <View style={styles.scopeGroup}>
      <Text style={[styles.scopeGroupLabel, { color: colors.textSecondary }]}>{category.name}</Text>
      <View style={styles.chipWrap}>
        {subs.data?.map((sc) => (
          <ScopeChip
            key={sc.id}
            label={sc.name}
            selected={hasScope(scopes, category.id, sc.id)}
            onPress={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: sc.id }))}
            colors={colors}
          />
        ))}
        {!subs.data?.length && (
          <Text style={[styles.scopeEmpty, { color: colors.textMuted }]}>{t('scopes.noSubcategories')}</Text>
        )}
      </View>
    </View>
  )
}

function ScopeChip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string
  selected: boolean
  onPress: () => void
  colors: Palette
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.brandFill, borderColor: colors.brandFill }
          : { backgroundColor: colors.surface1, borderColor: colors.border },
      ]}
    >
      {selected && <Check color={colors.brandOn} size={14} strokeWidth={2} />}
      <Text style={[styles.chipText, { color: selected ? colors.brandOn : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  )
}

export default function ProfileScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation('profile')
  const own = useOwnDoctor()
  const cats = useCategories()
  const updateProfile = useUpdateOwnProfile()
  const setScopes = useSetOwnScopes()

  const doctor = own.data?.doctor ?? null

  const [title, setTitle] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')
  const [scopes, setScopesState] = useState<DoctorScope[]>([])

  useEffect(() => {
    if (!own.data) return
    setTitle(own.data.doctor.title ?? '')
    setSpecialty(own.data.doctor.specialty ?? '')
    setBio(own.data.doctor.bio ?? '')
    setScopesState(own.data.scopes)
  }, [own.data])

  const saveProfile = async () => {
    if (!doctor) return
    try {
      await updateProfile.mutateAsync({
        title: title.trim() || null,
        specialty: specialty.trim() || null,
        bio: bio.trim() || null,
        weightedWork: doctor.weighted_work ?? null,
        photoUrl: doctor.photo_url,
      })
      Alert.alert(t('alerts.savedTitle'), t('alerts.profileSaved'))
    } catch (e) {
      Alert.alert(t('alerts.saveFailedTitle'), (e as Error).message)
    }
  }

  const saveScopes = async () => {
    if (!scopes.length) {
      Alert.alert(t('scopes.alerts.requiredTitle'), t('scopes.alerts.requiredMessage'))
      return
    }
    try {
      await setScopes.mutateAsync(scopes)
      Alert.alert(t('alerts.savedTitle'), t('scopes.alerts.saved'))
    } catch (e) {
      Alert.alert(t('alerts.saveFailedTitle'), (e as Error).message)
    }
  }

  const cardStyle = useMemo(
    () => [styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }],
    [colors],
  )
  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface1, borderColor: colors.border, color: colors.textPrimary },
  ]

  if (own.isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface0 }]}>
        <ActivityIndicator color={colors.brandText} />
      </View>
    )
  }

  if (!doctor) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface0 }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('notFound')}</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.surface0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Profil */}
        <View style={cardStyle}>
          <View style={styles.cardHeader}>
            <UserCircle color={colors.textSecondary} size={18} strokeWidth={1.75} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('title')}</Text>
          </View>

          <View style={styles.avatarRow}>
            <ProfileAvatar photoUrl={doctor.photo_url} name={title || t('doctorLabel')} colors={colors} />
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('fields.title')}</Text>
          <TextInput
            style={inputStyle}
            value={title}
            onChangeText={setTitle}
            placeholder={t('fields.titlePlaceholder')}
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('fields.specialty')}</Text>
          <TextInput
            style={inputStyle}
            value={specialty}
            onChangeText={setSpecialty}
            placeholder={t('fields.specialtyPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('fields.bio')}</Text>
          <TextInput
            style={[inputStyle, styles.multiline]}
            value={bio}
            onChangeText={setBio}
            placeholder={t('fields.bioPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <Pressable
            onPress={saveProfile}
            disabled={updateProfile.isPending}
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: colors.brandFill }, updateProfile.isPending && styles.disabled]}
          >
            {updateProfile.isPending ? (
              <ActivityIndicator color={colors.brandOn} />
            ) : (
              <>
                <Save color={colors.brandOn} size={18} strokeWidth={1.75} />
                <Text style={[styles.primaryButtonText, { color: colors.brandOn }]}>{t('common:actions.save')}</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Yetkinlikler */}
        <View style={cardStyle}>
          <View style={styles.cardHeader}>
            <Check color={colors.textSecondary} size={18} strokeWidth={1.75} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('scopes.title')}</Text>
          </View>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            {t('scopes.helper')}
          </Text>

          <View style={styles.scopeList}>
            {cats.data?.map((c) => (
              <CategoryScopeRow key={c.id} category={c} scopes={scopes} onChange={setScopesState} colors={colors} />
            ))}
          </View>

          {!scopes.length && (
            <Text style={[styles.warnText, { color: colors.warningText }]}>{t('scopes.warnMin')}</Text>
          )}

          <Pressable
            onPress={saveScopes}
            disabled={!scopes.length || setScopes.isPending}
            accessibilityRole="button"
            style={[
              styles.primaryButton,
              { backgroundColor: colors.brandFill },
              (!scopes.length || setScopes.isPending) && styles.disabled,
            ]}
          >
            {setScopes.isPending ? (
              <ActivityIndicator color={colors.brandOn} />
            ) : (
              <>
                <Check color={colors.brandOn} size={18} strokeWidth={1.75} />
                <Text style={[styles.primaryButtonText, { color: colors.brandOn }]}>{t('scopes.submit')}</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.four },
  emptyText: { fontFamily: fontFamily.medium, fontSize: 15, textAlign: 'center' },
  scrollContent: { padding: spacing.four, gap: spacing.four },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.three,
    gap: spacing.two,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.one },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 16 },
  avatarRow: { marginTop: spacing.half },
  avatar: { width: 64, height: 64, borderRadius: radius.full },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarInitial: { fontFamily: fontFamily.semibold, fontSize: 24 },
  fieldLabel: { fontFamily: fontFamily.medium, fontSize: 13, marginTop: spacing.one },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.two,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    minHeight: 44,
  },
  multiline: { minHeight: 96 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    minHeight: 44,
    marginTop: spacing.two,
  },
  primaryButtonText: { fontFamily: fontFamily.semibold, fontSize: 15 },
  disabled: { opacity: 0.5 },
  helperText: { fontFamily: fontFamily.regular, fontSize: 13 },
  scopeList: { gap: spacing.two, marginTop: spacing.half },
  scopeGroup: { gap: spacing.one },
  scopeGroupLabel: { fontFamily: fontFamily.medium, fontSize: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.one },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.one,
    minHeight: 44,
  },
  chipText: { fontFamily: fontFamily.medium, fontSize: 13 },
  scopeEmpty: { fontFamily: fontFamily.regular, fontSize: 13 },
  warnText: { fontFamily: fontFamily.medium, fontSize: 12 },
})
