import { StyleSheet, Text, View } from 'react-native'

import { STATUS_COLORS, STATUS_LABELS, type RequestStatus } from '@/domain/status'
import { fontFamily, radius } from '@/theme'

export function StatusPill({ status }: { status: RequestStatus }) {
  const c = STATUS_COLORS[status]
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{STATUS_LABELS[status]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
  },
})
