import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { PatientInfoCard } from '@/components/PatientInfoCard'
import { PhotoStrip } from '@/components/PhotoStrip'
import { StatusPill } from '@/components/StatusPill'
import { Spinner } from '@/components/ui/Spinner'
import { useRequestDetail } from '@/features/request/useRequestDetail'
import { timeAgo } from '@/domain/format'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { rtlIconStyle } from '@/lib/rtl'
import { fontFamily, radius, spacing } from '@/theme'

/** Koordinatör talep detayı — salt okunur (kabul/red yok; yönetim listede). */
export default function AdminRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { role } = useAuth()
  const { colors } = useTheme()
  const { t } = useTranslation('request')
  const detail = useRequestDetail(id)

  // Bu ekran yalnız koordinatör/admin/super_admin içindir; doktor kendi ekranını kullanır.
  if (role === 'doctor') return <Redirect href="/(tabs)" />

  if (detail.isLoading) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.surface0 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Spinner />
      </View>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.surface0 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{t('errors.loadFailedShort')}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={[styles.backLinkText, { color: colors.brandText }]}>{t('admin.backLink')}</Text>
        </Pressable>
      </View>
    )
  }

  const { req, patientName, categoryName, subcategoryName, operationName, photos, xrays } = detail.data
  const title = `${patientName} — ${operationName ?? subcategoryName ?? categoryName ?? ''}`

  return (
    <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.back} hitSlop={8}>
          <ChevronLeft color={colors.textSecondary} size={22} strokeWidth={1.75} style={rtlIconStyle} />
          <Text style={[styles.backText, { color: colors.textSecondary }]}>{t('admin.backToList')}</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('idSubtitle', { shortId: req.id.slice(0, 8), time: timeAgo(req.created_at, t) })}
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

        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('photos')}</Text>
          {photos.length > 0 ? (
            <PhotoStrip urls={photos} altLabel={t('photoAlt')} />
          ) : (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('photosEmpty')}</Text>
          )}
        </View>

        {xrays.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('xrays')}</Text>
            <PhotoStrip urls={xrays} altLabel={t('xrayAlt')} />
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.two },
  errorText: { fontFamily: fontFamily.medium, fontSize: 15 },
  backLink: { padding: spacing.two },
  backLinkText: { fontFamily: fontFamily.semibold, fontSize: 14 },
  scrollContent: { padding: spacing.four, gap: spacing.three },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginStart: -6 },
  backText: { fontFamily: fontFamily.medium, fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.two },
  headerText: { flex: 1 },
  title: { fontFamily: fontFamily.display, fontSize: 20 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.three,
    gap: spacing.two,
  },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 15 },
  emptyText: { fontFamily: fontFamily.regular, fontSize: 13 },
})
