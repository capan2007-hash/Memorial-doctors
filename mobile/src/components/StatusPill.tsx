import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { STATUS_ROLE, type RequestStatus } from '@/domain/status'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, roleColors } from '@/theme'

/** State-dot çip: öncü nokta + etiket (i18n: common.status.*), semantik renk (temaya göre). */
export function StatusPill({ status }: { status: RequestStatus }) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const c = roleColors(colors, STATUS_ROLE[status])
  return (
    <View style={[styles.root, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[styles.dot, { backgroundColor: c.text }]} />
      <Text style={[styles.text, { color: c.text }]}>{t(`common:status.${status}`)}</Text>
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
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  text: { fontSize: 12, fontFamily: fontFamily.semibold, letterSpacing: 0.1 },
})
