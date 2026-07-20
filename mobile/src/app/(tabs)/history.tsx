import { useRouter } from 'expo-router'
import { Inbox } from 'lucide-react-native'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { useDoctorQueue, type DoctorQueueRow } from '@/features/queue/useDoctorQueue'
import { QueueRow } from '@/features/queue/QueueRow'
import { DecisionBadge } from '@/components/DecisionBadge'
import { useTheme } from '@/lib/theme'
import { fontFamily, spacing } from '@/theme'

export default function HistoryScreen() {
  const { doctorId } = useAuth()
  const queue = useDoctorQueue(doctorId)
  const router = useRouter()
  const { colors } = useTheme()

  return (
    <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Geçmiş</Text>
      {queue.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandText} />
        </View>
      ) : (
        <FlatList
          data={queue.history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={queue.isFetching && !queue.isLoading} onRefresh={() => queue.refetch()} />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.two }} />}
          renderItem={({ item }: { item: DoctorQueueRow }) => (
            <QueueRow
              patientName={item.patientName}
              categoryName={item.categoryName}
              assignedAt={item.assignedAt}
              badge={item.myResponse ? <DecisionBadge decision={item.myResponse.decision} /> : null}
              onPress={() => router.push({ pathname: '/request/[id]', params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Inbox color={colors.textMuted} size={40} strokeWidth={1.5} />
              <Text style={[styles.hint, { color: colors.textMuted }]}>Yanıtladığınız talep yok</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.four,
    paddingTop: spacing.four,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    marginBottom: spacing.three,
  },
  listContent: {
    paddingBottom: spacing.four,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.two,
    paddingTop: spacing.six,
  },
  hint: {
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
})
