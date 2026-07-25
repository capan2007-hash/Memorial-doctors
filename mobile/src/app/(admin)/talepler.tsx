import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { AlertTriangle, ChevronRight, Clock, RefreshCw } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/StatusPill'
import { timeAgo } from '@/domain/format'
import { slaLabel } from '@/domain/sla'
import { useTheme } from '@/lib/theme'
import { rtlIconStyle } from '@/lib/rtl'
import { fontFamily, radius, roleColors, spacing, type Palette } from '@/theme'
import {
  classify,
  useAllRequests,
  useReassign,
  useTenantSla,
  type EnrichedRequestRow,
  type SlaTab,
} from '@/features/admin/useAllRequests'

const TABS: SlaTab[] = ['all', 'pending', 'overdue', 'completed']

type Row = { row: EnrichedRequestRow; tab: Exclude<SlaTab, 'all'>; info: ReturnType<typeof classify>['info'] }

function FilterTabs({
  value,
  counts,
  onChange,
  colors,
}: {
  value: SlaTab
  counts: Record<SlaTab, number>
  onChange: (t: SlaTab) => void
  colors: Palette
}) {
  const { t } = useTranslation('admin')
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabScroll}
      contentContainerStyle={styles.tabRow}
    >
      {TABS.map((tabKey) => {
        const active = value === tabKey
        return (
          <Pressable
            key={tabKey}
            onPress={() => onChange(tabKey)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.tab,
              active
                ? { backgroundColor: colors.brandFill, borderColor: colors.brandFill }
                : { backgroundColor: colors.surface1, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.tabText, { color: active ? colors.brandOn : colors.textSecondary }]}>
              {t(`requests.tabs.${tabKey}`)} <Text style={styles.tnum}>{counts[tabKey]}</Text>
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function RequestRow({
  item,
  reassigning,
  onReassign,
  colors,
}: {
  item: Row
  reassigning: boolean
  onReassign: () => void
  colors: Palette
}) {
  const { t } = useTranslation('admin')
  const { row: r, tab, info } = item
  const isClosed = r.status === 'closed'
  const danger = roleColors(colors, 'danger')
  const warning = roleColors(colors, 'warning')

  return (
    <View style={styles.rowWrap}>
      <Pressable
        onPress={() => router.push(`/talep/${r.id}`)}
        accessibilityRole="button"
        style={[
          styles.card,
          { backgroundColor: colors.surface2, borderColor: colors.border },
          tab === 'overdue' && { borderLeftWidth: 3, borderLeftColor: danger.border },
        ]}
      >
        <Avatar name={r.patientName} size={40} />
        <View style={styles.cardBody}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {r.patientName}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {r.categoryName} · {timeAgo(r.created_at, t)}
          </Text>
          <View style={styles.badgeRow}>
            {r.status === 'submitted' && (
              <View style={[styles.badge, { backgroundColor: warning.bg }]}>
                <Text style={[styles.badgeText, { color: warning.text }]}>{t('requests.unassignedBadge')}</Text>
              </View>
            )}
            {info && tab === 'overdue' && (
              <View style={[styles.badge, styles.badgeIcon, { backgroundColor: danger.bg }]}>
                <AlertTriangle color={danger.text} size={12} strokeWidth={2} />
                <Text style={[styles.badgeText, { color: danger.text }]}>{slaLabel(info)}</Text>
              </View>
            )}
            {info && tab === 'pending' && info.state === 'warning' && (
              <View style={[styles.badge, styles.badgeIcon, { backgroundColor: warning.bg }]}>
                <Clock color={warning.text} size={12} strokeWidth={2} />
                <Text style={[styles.badgeText, { color: warning.text }]}>{slaLabel(info)}</Text>
              </View>
            )}
            <StatusPill status={r.status} />
          </View>
        </View>
        <ChevronRight color={colors.textMuted} size={18} strokeWidth={1.75} style={rtlIconStyle} />
      </Pressable>

      <Pressable
        onPress={onReassign}
        disabled={isClosed || reassigning}
        accessibilityRole="button"
        style={[
          styles.reassign,
          { borderColor: colors.border, backgroundColor: colors.surface1 },
          (isClosed || reassigning) && styles.disabled,
        ]}
      >
        {reassigning ? (
          <ActivityIndicator color={colors.brandText} size="small" />
        ) : (
          <>
            <RefreshCw color={colors.textSecondary} size={14} strokeWidth={1.75} />
            <Text style={[styles.reassignText, { color: colors.textSecondary }]}>{t('requests.reassign')}</Text>
          </>
        )}
      </Pressable>
    </View>
  )
}

export default function TaleplerScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation('admin')
  const reqs = useAllRequests()
  const tenantSla = useTenantSla()
  const reassign = useReassign()
  const [tab, setTab] = useState<SlaTab>('all')
  const [reassigningId, setReassigningId] = useState<string | null>(null)

  const slaHours = tenantSla.data?.sla_hours ?? 24
  const reminderHours = tenantSla.data?.sla_reminder_hours ?? 4

  const classified: Row[] = useMemo(() => {
    const now = new Date()
    return (reqs.data ?? []).map((r) => ({ row: r, ...classify(r, slaHours, reminderHours, now) }))
  }, [reqs.data, slaHours, reminderHours])

  const counts: Record<SlaTab, number> = useMemo(
    () => ({
      all: classified.length,
      pending: classified.filter((c) => c.tab === 'pending').length,
      overdue: classified.filter((c) => c.tab === 'overdue').length,
      completed: classified.filter((c) => c.tab === 'completed').length,
    }),
    [classified],
  )

  const visible = tab === 'all' ? classified : classified.filter((c) => c.tab === tab)

  const onReassign = async (item: Row) => {
    setReassigningId(item.row.id)
    try {
      const { assigned } = await reassign.mutateAsync(item.row)
      Alert.alert(
        assigned ? t('requests.alerts.reassignedTitle') : t('requests.alerts.noDoctorTitle'),
        assigned ? t('requests.alerts.reassignedMessage') : t('requests.alerts.noDoctorMessage'),
      )
    } catch (e) {
      Alert.alert(t('requests.alerts.failedTitle'), (e as Error).message)
    } finally {
      setReassigningId(null)
    }
  }

  if (reqs.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
        <Spinner />
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
      <FilterTabs value={tab} counts={counts} onChange={setTab} colors={colors} />
      {visible.length === 0 ? (
        <EmptyState
          title={counts.all === 0 ? t('requests.empty.noneTitle') : t('requests.empty.filteredTitle')}
          description={counts.all === 0 ? t('requests.empty.description') : undefined}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.row.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RequestRow
              item={item}
              reassigning={reassigningId === item.row.id}
              onReassign={() => onReassign(item)}
              colors={colors}
            />
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tnum: { fontVariant: ['tabular-nums'] },
  // Yatay ScrollView dikeyde esnemesin (flexGrow:0) ve çipler gerilmesin (alignItems).
  tabScroll: { flexGrow: 0, flexShrink: 0 },
  tabRow: {
    gap: spacing.one,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.three,
    alignItems: 'center',
  },
  tab: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.one + 2,
  },
  tabText: { fontFamily: fontFamily.medium, fontSize: 13 },
  list: { paddingHorizontal: spacing.four, paddingBottom: spacing.four, gap: spacing.two },
  rowWrap: { gap: spacing.one },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.three,
  },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fontFamily.semibold, fontSize: 15 },
  meta: { fontFamily: fontFamily.regular, fontSize: 13 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.one, marginTop: 4 },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.one + 2, paddingVertical: 2 },
  badgeIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { fontFamily: fontFamily.medium, fontSize: 11 },
  reassign: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.half,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingVertical: spacing.one + 2,
    minHeight: 40,
  },
  reassignText: { fontFamily: fontFamily.medium, fontSize: 13 },
  disabled: { opacity: 0.5 },
})
