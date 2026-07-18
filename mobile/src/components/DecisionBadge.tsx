import { StyleSheet, Text, View } from 'react-native'

import { DECISION_COLORS, DECISION_LABELS, type Decision } from '@/domain/status'
import { fontFamily, radius } from '@/theme'

export function DecisionBadge({ decision }: { decision: Decision }) {
  const c = DECISION_COLORS[decision]
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{DECISION_LABELS[decision]}</Text>
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
