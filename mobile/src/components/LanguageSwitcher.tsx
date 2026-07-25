// Kaynak deseni: /src/i18n/index.ts + /src/features/settings/useSetLanguage.ts (web).
// Yeniden kullanılabilir dil seçici satır listesi — Ayarlar (doktor) ve Ayarlar
// (koordinatör/admin) ekranlarında ortak kullanılır.
import { Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Alert, I18nManager, Pressable, StyleSheet, Text, View } from 'react-native'

import { RTL_LANGS, type Lang } from '@/i18n'
import { useAppLanguage } from '@/i18n/useAppLanguage'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing } from '@/theme'

const LANGUAGES: Array<{ code: Lang; flag: string; label: string }> = [
  { code: 'tr', flag: '🇹🇷', label: 'Türkçe' },
  { code: 'ar', flag: '🇸🇦', label: 'العربية' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
]

/**
 * Not: RTL yönü (I18nManager.forceRTL) yalnızca uygulama yeniden başlatıldığında tam olarak
 * yansır. `expo-updates` şu an proje bağımlılığı DEĞİL — bu yüzden burada yalnızca Alert ile
 * "uygulamayı yeniden açın" uyarısı gösterilir. `expo-updates` eklendiğinde bu Alert,
 * `Updates.reloadAsync()` çağrısıyla değiştirilebilir (tam RTL görsel geçiş: Faz M1 Task 8).
 */
export function LanguageSwitcher() {
  const { colors } = useTheme()
  const { t } = useTranslation('common')
  const { lang, changeLang } = useAppLanguage()

  const handleSelect = (code: Lang) => {
    if (code === lang) return
    changeLang(code)

    const shouldBeRTL = RTL_LANGS.has(code)
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL)
      Alert.alert(t('language.restartTitle'), t('language.restartMessage'), [
        { text: t('language.restartConfirm') },
      ])
    }
  }

  return (
    <View style={styles.list}>
      {LANGUAGES.map(({ code, flag, label }) => {
        const selected = code === lang
        return (
          <Pressable
            key={code}
            onPress={() => handleSelect(code)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.surface2,
                borderColor: selected ? colors.brandFill : colors.border,
              },
              pressed && { backgroundColor: colors.surface1 },
            ]}
          >
            <Text style={styles.flag}>{flag}</Text>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
            {selected && <Check color={colors.brandText} size={18} strokeWidth={2} />}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    minHeight: 52,
  },
  flag: {
    fontSize: 20,
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
})
