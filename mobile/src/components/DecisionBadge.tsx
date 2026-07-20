import { StyleSheet, Text, View } from 'react-native'

import { DECISION_LABELS, DECISION_ROLE, type Decision } from '@/domain/status'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, roleColors } from '@/theme'

export function DecisionBadge({ decision }: { decision: Decision }) {
  const { colors } = useTheme()
  const c = roleColors(colors, DECISION_ROLE[decision])
  return (
    <View style={[styles.root, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[styles.dot, { backgroundColor: c.text }]} />
      <Text style={[styles.text, { color: c.text }]}>{DECISION_LABELS[decision]}</Text>
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
