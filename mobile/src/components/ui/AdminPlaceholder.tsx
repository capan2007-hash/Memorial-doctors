import { Clock } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { EmptyState } from '@/components/ui/EmptyState'
import { useTheme } from '@/lib/theme'

/** Koordinatör grubu geçici ekranı — ilgili faz gelene kadar "yakında" gösterir. */
export function AdminPlaceholder({ title }: { title: string }) {
  const { colors } = useTheme()
  const { t } = useTranslation('common')
  return (
    <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
      <EmptyState icon={Clock} title={title} description={t('placeholder.comingSoon')} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
})
