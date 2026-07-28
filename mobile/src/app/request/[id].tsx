// Kaynak: /src/features/doctor/DoctorRequestView.tsx (web) — hasta kartı, foto
// galerisi ve kabul/red akışı aynı sözleşmeyle (yalnız response insert; status'u
// server trigger'ı hesaplar) mobile'a taşındı.
import { useState } from 'react'
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, ChevronLeft, X } from 'lucide-react-native'

import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { rtlIconStyle } from '@/lib/rtl'
import { useRequestDetail } from '@/features/request/useRequestDetail'
import { useRespond } from '@/features/request/useRespond'
import { PatientInfoCard } from '@/components/PatientInfoCard'
import { PhotoStrip } from '@/components/PhotoStrip'
import { StatusPill } from '@/components/StatusPill'
import { DecisionBadge } from '@/components/DecisionBadge'
import { SkeletonList } from '@/components/ui/Skeleton'
import { AiPanel } from '@/features/ai/AiPanel'
import { TranslatedText } from '@/features/i18n-content/TranslatedText'
import { timeAgo } from '@/domain/format'
import { DECISION_ROLE, STATUS_ROLE } from '@/domain/status'
import { fontFamily, radius, roleColors, shadow, spacing, type Palette } from '@/theme'

type Mode = 'none' | 'accept' | 'reject'

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { tenantId, doctorId, session, loading } = useAuth()
  const { colors } = useTheme()
  const { t, i18n } = useTranslation('request')
  const insets = useSafeAreaInsets()
  // iOS: KeyboardAvoidingView header'ın altında başlar → klavye yüksekliğini
  // header kadar eksik hesaplar. Stack header'ı ≈ 44pt + üst güvenli alan.
  const keyboardOffset = Platform.OS === 'ios' ? insets.top + 44 : 0
  const styles = makeStyles(colors, insets.bottom)
  const detail = useRequestDetail(id)
  const respond = useRespond()

  const [mode, setMode] = useState<Mode>('none')
  const [plan, setPlan] = useState('')
  const [reason, setReason] = useState('')
  const [respError, setRespError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const screenOptions = {
    headerShown: true,
    title: '',
    headerStyle: { backgroundColor: colors.surface0 },
    headerShadowVisible: false,
    headerTintColor: colors.textPrimary,
    headerLeft: () => (
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('backLabel')}
        hitSlop={8}
        style={styles.backButton}
      >
        <ChevronLeft color={colors.textPrimary} size={26} strokeWidth={2} style={rtlIconStyle} />
      </Pressable>
    ),
  } as const

  // Bu rota (tabs) dışında: soğuk başlangıç bildirimi oturumsuz açabilir.
  if (!loading && !session) return <Redirect href="/login" />

  if (detail.isError) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.errorText}>{t('errors.loadFailed')}</Text>
      </View>
    )
  }

  if (detail.isLoading || !detail.data) {
    return (
      <View style={[styles.root]}>
        <Stack.Screen options={screenOptions} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SkeletonList count={4} />
        </ScrollView>
      </View>
    )
  }

  const { req, patientName, categoryName, subcategoryName, operationName, procedureNames, photos, xrays, myResponse } = detail.data
  // Başlık: çoklu işlem varsa ilk iki işlem + "+N"; yoksa eski tekil alanlara düşer.
  const procedureTitle =
    procedureNames.length > 2
      ? `${procedureNames.slice(0, 2).join(', ')} +${procedureNames.length - 2}`
      : procedureNames.join(', ')
  const title = `${patientName} — ${procedureTitle || operationName || subcategoryName || categoryName || ''}`
  const statusTint = roleColors(colors, STATUS_ROLE[req.status])
  const decisionTint = myResponse ? roleColors(colors, DECISION_ROLE[myResponse.decision]) : null

  const submit = async () => {
    if (!tenantId || !doctorId) return
    setRespError(null)
    try {
      await respond.mutateAsync({
        tenantId,
        requestId: req.id,
        doctorId,
        decision: mode === 'accept' ? 'accept' : 'reject',
        treatmentPlan: mode === 'accept' ? plan : undefined,
        rejectReason: mode === 'reject' ? reason : undefined,
        sourceLang: i18n.language,
      })
      setMode('none')
      setSuccess(true)
    } catch (e) {
      setRespError(t('errors.respondFailed', { message: (e as Error).message }))
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // Ekranda navigation header VAR (headerShown: true). KeyboardAvoidingView
      // header'ın ALTINDA başladığı için offset verilmezse klavye yüksekliği
      // header kadar eksik hesaplanır → yazı alanı klavyenin altında kalır.
      keyboardVerticalOffset={keyboardOffset}
    >
      <Stack.Screen options={screenOptions} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.subtitle}>
              {t('idSubtitle', { shortId: req.id.slice(0, 8), time: timeAgo(req.created_at, t) })}
            </Text>
          </View>
          <View style={[styles.statusBand, { backgroundColor: statusTint.bg, borderColor: statusTint.border }]}>
            <StatusPill status={req.status} />
          </View>
        </View>

        <PatientInfoCard
          req={req}
          patientName={patientName}
          categoryName={categoryName}
          subcategoryName={subcategoryName}
          operationName={operationName}
          procedureNames={procedureNames}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('photos')}</Text>
          {photos.length > 0 ? (
            <PhotoStrip urls={photos} altLabel={t('photoAlt')} />
          ) : (
            <Text style={styles.emptyText}>{t('photosEmpty')}</Text>
          )}
        </View>

        {xrays.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('xrays')}</Text>
            <PhotoStrip urls={xrays} altLabel={t('xrayAlt')} />
          </View>
        )}

        <AiPanel requestId={req.id} doctorId={doctorId} />

        {myResponse && decisionTint && (
          <View
            style={[styles.card, { backgroundColor: decisionTint.bg, borderColor: decisionTint.border }]}
          >
            <View style={styles.decisionHeader}>
              <Text style={styles.cardTitle}>{t('decisionHeading')}</Text>
              <DecisionBadge decision={myResponse.decision} />
            </View>
            {myResponse.decision === 'accept' ? (
              myResponse.treatment_plan ? (
                <TranslatedText text={myResponse.treatment_plan} sourceLang={myResponse.source_lang} style={styles.value} />
              ) : (
                <Text style={styles.value}>{t('planNotSpecified')}</Text>
              )
            ) : (
              <Text style={styles.value}>{myResponse.reject_reason || t('reasonNotSpecified')}</Text>
            )}
          </View>
        )}

        {success && !myResponse && <Text style={styles.successText}>{t('responseSaved')}</Text>}
      </ScrollView>

      {!myResponse && (
        <View style={styles.actionBar}>
          {respError && <Text style={styles.errorText}>{respError}</Text>}
          {mode === 'none' && (
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.button, styles.acceptButton, pressed && styles.buttonPressed]}
                onPress={() => setMode('accept')}
              >
                <Check color={colors.brandOn} size={18} strokeWidth={2} />
                <Text style={styles.acceptButtonText}>{t('actions.accept')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.button, styles.rejectButton, pressed && styles.buttonPressed]}
                onPress={() => setMode('reject')}
              >
                <X color={colors.dangerText} size={18} strokeWidth={2} />
                <Text style={styles.rejectButtonText}>{t('actions.reject')}</Text>
              </Pressable>
            </View>
          )}
          {mode === 'accept' && (
            <View style={styles.gap}>
              <Text style={styles.label}>{t('actions.planLabel')}</Text>
              <TextInput
                style={styles.textArea}
                placeholder={t('actions.planPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={plan}
                onChangeText={setPlan}
                multiline
              />
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.acceptButton,
                  !plan && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                disabled={!plan || respond.isPending}
                onPress={submit}
              >
                {respond.isPending ? (
                  <ActivityIndicator color={colors.brandOn} />
                ) : (
                  <>
                    <Check color={colors.brandOn} size={18} strokeWidth={2} />
                    <Text style={styles.acceptButtonText}>{t('actions.acceptConfirm')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
          {mode === 'reject' && (
            <View style={styles.gap}>
              <Text style={styles.label}>{t('actions.reasonLabel')}</Text>
              <TextInput
                style={styles.textArea}
                placeholder={t('actions.reasonPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={reason}
                onChangeText={setReason}
                multiline
              />
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.rejectButton,
                  !reason && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                disabled={!reason || respond.isPending}
                onPress={submit}
              >
                {respond.isPending ? (
                  <ActivityIndicator color={colors.dangerText} />
                ) : (
                  <>
                    <X color={colors.dangerText} size={18} strokeWidth={2} />
                    <Text style={styles.rejectButtonText}>{t('actions.rejectConfirm')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: Palette, bottomInset = 0) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.surface0,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface0,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginStart: -8,
    },
    scrollContent: {
      padding: spacing.four,
      gap: spacing.four,
      paddingBottom: spacing.six,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.two,
    },
    title: {
      fontFamily: fontFamily.display,
      fontSize: 19,
      color: colors.textPrimary,
    },
    subtitle: {
      fontFamily: fontFamily.regular,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statusBand: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.one,
    },
    card: {
      backgroundColor: colors.surface2,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.four,
      gap: spacing.two,
      ...shadow.card,
    },
    cardTitle: {
      fontFamily: fontFamily.display,
      fontSize: 17,
      color: colors.textPrimary,
    },
    emptyText: {
      fontFamily: fontFamily.regular,
      fontSize: 13,
      color: colors.textMuted,
    },
    value: {
      fontFamily: fontFamily.regular,
      fontSize: 14,
      color: colors.textPrimary,
    },
    decisionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    successText: {
      fontFamily: fontFamily.medium,
      color: colors.brandText,
      textAlign: 'center',
    },
    actionBar: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface1,
      padding: spacing.three,
      // Home indicator (çentiksiz alt boşluk) panelin altına girmesin; klavye
      // açıkken KeyboardAvoidingView zaten yukarı ittiği için ekstra boşluk sorun olmaz.
      paddingBottom: Math.max(spacing.three, bottomInset),
      gap: spacing.two,
      ...shadow.raised,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.two,
    },
    gap: {
      gap: spacing.two,
    },
    label: {
      fontFamily: fontFamily.medium,
      color: colors.textSecondary,
    },
    textArea: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.two,
      minHeight: 80,
      // Uzun metin yazıldıkça alan büyüyüp klavyenin üstündeki yeri taşırmasın;
      // sınırdan sonra kendi içinde kaydırılır (yazılan satır görünür kalır).
      maxHeight: 120,
      textAlignVertical: 'top',
      fontFamily: fontFamily.regular,
      color: colors.textPrimary,
      backgroundColor: colors.surface1,
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      gap: spacing.one,
      minHeight: 44,
      borderRadius: radius.md,
      paddingVertical: spacing.two,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptButton: {
      backgroundColor: colors.brandFill,
    },
    rejectButton: {
      backgroundColor: colors.dangerBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.dangerBorder,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    acceptButtonText: {
      color: colors.brandOn,
      fontFamily: fontFamily.semibold,
      fontSize: 15,
    },
    rejectButtonText: {
      color: colors.dangerText,
      fontFamily: fontFamily.semibold,
      fontSize: 15,
    },
    errorText: {
      color: colors.dangerText,
      fontFamily: fontFamily.regular,
      fontSize: 13,
    },
  })
