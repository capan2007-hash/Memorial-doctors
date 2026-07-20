import { StyleSheet, Text, View } from 'react-native'

import { STATUS_LABELS, STATUS_ROLE, type RequestStatus } from '@/domain/status'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, roleColors } from '@/theme'

/** State-dot çip: öncü nokta + Türkçe etiket, semantik renk (temaya göre). */
export function StatusPill({ status }: { status: RequestStatus }) {
  const { colors } = useTheme()
  const c = roleColors(colors, STATUS_ROLE[status])
  return (
    <View style={[styles.root, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[styles.dot, { backgroundColor: c.text }]} />
      <Text style={[styles.text, { color: c.text }]}>{STATUS_LABELS[status]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontFamily: fontFamily.medium },
})
