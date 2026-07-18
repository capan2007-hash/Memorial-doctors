import { useRouter } from 'expo-router'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/lib/auth'
import { useDoctorQueue, type DoctorQueueRow } from '@/features/queue/useDoctorQueue'
import { QueueRow } from '@/features/queue/QueueRow'
import { colors, fontFamily, spacing } from '@/theme'

export default function PendingQueueScreen() {
  const { doctorId } = useAuth()
  const queue = useDoctorQueue(doctorId)
  const router = useRouter()

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Bekleyen Talepler</Text>
      {queue.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand[600]} />
        </View>
      ) : (
        <FlatList
          data={queue.pending}
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
              onPress={() => router.push({ pathname: '/request/[id]', params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.hint}>Bekleyen talep yok</Text>
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.four,
    paddingTop: spacing.four,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    color: colors.slate[900],
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
    paddingTop: spacing.six,
  },
  hint: {
    fontFamily: fontFamily.regular,
    color: colors.slate[500],
    textAlign: 'center',
  },
})
