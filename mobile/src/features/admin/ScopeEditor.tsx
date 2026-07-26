import { Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
  hasScope,
  toggleScope,
  useCategories,
  useSubcategories,
  type CategoryRow,
  type DoctorScope,
} from '@/features/profile/useOwnProfile'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing, type Palette } from '@/theme'

function ScopeChip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string
  selected: boolean
  onPress: () => void
  colors: Palette
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.brandFill, borderColor: colors.brandFill }
          : { backgroundColor: colors.surface0, borderColor: colors.border },
      ]}
    >
      {selected && <Check color={colors.brandOn} size={13} strokeWidth={2} />}
      <Text style={[styles.chipText, { color: selected ? colors.brandOn : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  )
}

function CategoryScopeRow({
  category,
  scopes,
  onChange,
  colors,
}: {
  category: CategoryRow
  scopes: DoctorScope[]
  onChange: (next: DoctorScope[]) => void
  colors: Palette
}) {
  const { t } = useTranslation('admin')
  const subs = useSubcategories(category.has_subcategories ? category.id : undefined)

  if (!category.has_subcategories) {
    return (
      <ScopeChip
        label={category.name}
        selected={hasScope(scopes, category.id, null)}
        onPress={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: null }))}
        colors={colors}
      />
    )
  }

  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>{category.name}</Text>
      <View style={styles.chipWrap}>
        {subs.data?.map((sc) => (
          <ScopeChip
            key={sc.id}
            label={sc.name}
            selected={hasScope(scopes, category.id, sc.id)}
            onPress={() => onChange(toggleScope(scopes, { categoryId: category.id, subcategoryId: sc.id }))}
            colors={colors}
          />
        ))}
        {!subs.data?.length && <Text style={[styles.empty, { color: colors.textMuted }]}>{t('scopeEditor.noSubcategories')}</Text>}
      </View>
    </View>
  )
}

/** Doktor yetkinlik (scope) seçici: kategori/alt-kırılım çipleri. Doktor + yeni-doktor ekranlarında paylaşılır. */
export function ScopeEditor({ scopes, onChange }: { scopes: DoctorScope[]; onChange: (next: DoctorScope[]) => void }) {
  const { colors } = useTheme()
  const cats = useCategories()
  return (
    <View style={styles.list}>
      {cats.data?.map((c) => (
        <CategoryScopeRow key={c.id} category={c} scopes={scopes} onChange={onChange} colors={colors} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.two },
  group: { gap: spacing.one },
  groupLabel: { fontFamily: fontFamily.medium, fontSize: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.one },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.one,
    minHeight: 40,
  },
  chipText: { fontFamily: fontFamily.medium, fontSize: 13 },
  empty: { fontFamily: fontFamily.regular, fontSize: 13 },
})
