// Kaynak: /src/features/doctor/DoctorRequestView.tsx (web) — hasta kartı, foto
// galerisi ve kabul/red akışı aynı sözleşmeyle (yalnız response insert; status'u
// server trigger'ı hesaplar) mobile'a taşındı.
import { useState } from 'react'
import { Stack, useLocalSearchParams } from 'expo-router'
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
import { useRequestDetail } from '@/features/request/useRequestDetail'
import { useRespond } from '@/features/request/useRespond'
import { PatientInfoCard } from '@/components/PatientInfoCard'
import { PhotoStrip } from '@/components/PhotoStrip'
import { StatusPill } from '@/components/StatusPill'
import { DecisionBadge } from '@/components/DecisionBadge'
import { timeAgo } from '@/domain/format'
import { colors, fontFamily, radius, spacing } from '@/theme'

type Mode = 'none' | 'accept' | 'reject'

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { tenantId, doctorId } = useAuth()
  const detail = useRequestDetail(id)
  const respond = useRespond()

  const [mode, setMode] = useState<Mode>('none')
  const [plan, setPlan] = useState('')
  const [reason, setReason] = useState('')
  const [respError, setRespError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (detail.isLoading || !detail.data) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <ActivityIndicator color={colors.brand[600]} />
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
      <Stack.Screen options={{ headerShown: true, title: '' }} />
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

        {/* AI paneli — Task 5 */}

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
                <Text style={styles.buttonText}>Kabul</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.rejectButton]} onPress={() => setMode('reject')}>
                <Text style={styles.buttonText}>Red</Text>
              </Pressable>
            </View>
          )}
          {mode === 'accept' && (
            <View style={styles.gap}>
              <Text style={styles.label}>Tedavi planı</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Tedavi planı"
                placeholderTextColor={colors.slate[400]}
                value={plan}
                onChangeText={setPlan}
                multiline
              />
              <Pressable
                style={[styles.button, styles.acceptButton, !plan && styles.buttonDisabled]}
                disabled={!plan || respond.isPending}
                onPress={submit}
              >
                {respond.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Kabul et</Text>}
              </Pressable>
            </View>
          )}
          {mode === 'reject' && (
            <View style={styles.gap}>
              <Text style={styles.label}>Red gerekçesi</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Red gerekçesi (zorunlu)"
                placeholderTextColor={colors.slate[400]}
                value={reason}
                onChangeText={setReason}
                multiline
              />
              <Pressable
                style={[styles.button, styles.rejectButton, !reason && styles.buttonDisabled]}
                disabled={!reason || respond.isPending}
                onPress={submit}
              >
                {respond.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Reddet</Text>}
              </Pressable>
            </View>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
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
    color: colors.slate[900],
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.slate[500],
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.three,
    gap: spacing.two,
  },
  cardTitle: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    color: colors.slate[900],
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.slate[500],
  },
  value: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.slate[800],
  },
  decisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  successText: {
    fontFamily: fontFamily.medium,
    color: colors.brand[700],
    textAlign: 'center',
  },
  actionBar: {
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    backgroundColor: colors.card,
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
    color: colors.slate[700],
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: radius.md,
    padding: spacing.two,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: fontFamily.regular,
    color: colors.slate[900],
    backgroundColor: colors.card,
  },
  button: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: colors.brand[600],
  },
  rejectButton: {
    backgroundColor: colors.danger[600],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.semibold,
    fontSize: 15,
  },
  errorText: {
    color: colors.danger[600],
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
})
