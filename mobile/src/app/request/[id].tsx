// Kaynak: /src/features/doctor/DoctorRequestView.tsx (web) — hasta kartı, foto
// galerisi ve kabul/red akışı aynı sözleşmeyle (yalnız response insert; status'u
// server trigger'ı hesaplar) mobile'a taşındı.
import { useState } from 'react'
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router'
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
import { Check, ChevronLeft, X } from 'lucide-react-native'

import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useRequestDetail } from '@/features/request/useRequestDetail'
import { useRespond } from '@/features/request/useRespond'
import { PatientInfoCard } from '@/components/PatientInfoCard'
import { PhotoStrip } from '@/components/PhotoStrip'
import { StatusPill } from '@/components/StatusPill'
import { DecisionBadge } from '@/components/DecisionBadge'
import { AiPanel } from '@/features/ai/AiPanel'
import { timeAgo } from '@/domain/format'
import { fontFamily, radius, spacing, type Palette } from '@/theme'

type Mode = 'none' | 'accept' | 'reject'

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { tenantId, doctorId, session, loading } = useAuth()
  const { colors } = useTheme()
  const styles = makeStyles(colors)
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
        accessibilityLabel="Geri"
        hitSlop={8}
        style={styles.backButton}
      >
        <ChevronLeft color={colors.textPrimary} size={26} strokeWidth={2} />
      </Pressable>
    ),
  } as const

  // Bu rota (tabs) dışında: soğuk başlangıç bildirimi oturumsuz açabilir.
  if (!loading && !session) return <Redirect href="/login" />

  if (detail.isError) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.errorText}>Talep yüklenemedi. Bağlantınızı kontrol edin.</Text>
      </View>
    )
  }

  if (detail.isLoading || !detail.data) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator color={colors.brandFill} />
      </View>
    )
  }

  const { req, patientName, categoryName, subcategoryName, operationName, photos, xrays, myResponse } = detail.data
  const title = `${patientName} — ${operationName ?? subcategoryName ?? categoryName ?? ''}`

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
      })
      setMode('none')
      setSuccess(true)
    } catch (e) {
      setRespError('Yanıt kaydedilemedi: ' + (e as Error).message)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={screenOptions} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.subtitle}>
              Talep #{req.id.slice(0, 8)} · {timeAgo(req.created_at)}
            </Text>
          </View>
          <StatusPill status={req.status} />
        </View>

        <PatientInfoCard
          req={req}
          patientName={patientName}
          categoryName={categoryName}
          subcategoryName={subcategoryName}
          operationName={operationName}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fotoğraflar</Text>
          {photos.length > 0 ? (
            <PhotoStrip urls={photos} altLabel="Fotoğraf" />
          ) : (
            <Text style={styles.emptyText}>Fotoğraf eklenmemiş</Text>
          )}
        </View>

        {xrays.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Diş Röntgeni</Text>
            <PhotoStrip urls={xrays} altLabel="Röntgen" />
          </View>
        )}

        <AiPanel requestId={req.id} doctorId={doctorId} />

        {myResponse && (
          <View style={styles.card}>
            <View style={styles.decisionHeader}>
              <Text style={styles.cardTitle}>Kararınız</Text>
              <DecisionBadge decision={myResponse.decision} />
            </View>
            <Text style={styles.value}>
              {myResponse.decision === 'accept'
                ? myResponse.treatment_plan || 'Tedavi planı belirtilmedi'
                : myResponse.reject_reason || 'Gerekçe belirtilmedi'}
            </Text>
          </View>
        )}

        {success && !myResponse && <Text style={styles.successText}>Yanıtınız kaydedildi.</Text>}
      </ScrollView>

      {!myResponse && (
        <View style={styles.actionBar}>
          {respError && <Text style={styles.errorText}>{respError}</Text>}
          {mode === 'none' && (
            <View style={styles.actionRow}>
              <Pressable style={[styles.button, styles.acceptButton]} onPress={() => setMode('accept')}>
                <Check color={colors.brandOn} size={18} strokeWidth={2} />
                <Text style={styles.acceptButtonText}>Kabul</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.rejectButton]} onPress={() => setMode('reject')}>
                <X color={colors.dangerText} size={18} strokeWidth={2} />
                <Text style={styles.rejectButtonText}>Red</Text>
              </Pressable>
            </View>
          )}
          {mode === 'accept' && (
            <View style={styles.gap}>
              <Text style={styles.label}>Tedavi planı</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Tedavi planı"
                placeholderTextColor={colors.textMuted}
                value={plan}
                onChangeText={setPlan}
                multiline
              />
              <Pressable
                style={[styles.button, styles.acceptButton, !plan && styles.buttonDisabled]}
                disabled={!plan || respond.isPending}
                onPress={submit}
              >
                {respond.isPending ? (
                  <ActivityIndicator color={colors.brandOn} />
                ) : (
                  <>
                    <Check color={colors.brandOn} size={18} strokeWidth={2} />
                    <Text style={styles.acceptButtonText}>Kabul et</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
          {mode === 'reject' && (
            <View style={styles.gap}>
              <Text style={styles.label}>Red gerekçesi</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Red gerekçesi (zorunlu)"
                placeholderTextColor={colors.textMuted}
                value={reason}
                onChangeText={setReason}
                multiline
              />
              <Pressable
                style={[styles.button, styles.rejectButton, !reason && styles.buttonDisabled]}
                disabled={!reason || respond.isPending}
                onPress={submit}
              >
                {respond.isPending ? (
                  <ActivityIndicator color={colors.dangerText} />
                ) : (
                  <>
                    <X color={colors.dangerText} size={18} strokeWidth={2} />
                    <Text style={styles.rejectButtonText}>Reddet</Text>
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

const makeStyles = (colors: Palette) =>
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
      marginLeft: -8,
    },
    scrollContent: {
      padding: spacing.four,
      gap: spacing.three,
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
    card: {
      backgroundColor: colors.surface2,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.three,
      gap: spacing.two,
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
      gap: spacing.two,
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
      borderRadius: radius.sm,
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
