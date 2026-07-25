// Kaynak deseni: /src/i18n/index.ts + /src/features/settings/useSetLanguage.ts (web).
// Yeniden kullanılabilir dil seçici satır listesi — Ayarlar (doktor) ve Ayarlar
// (koordinatör/admin) ekranlarında ortak kullanılır.
import { Check } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { Lang } from '@/i18n'
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
 * Not: RTL yönü senkronizasyonu (I18nManager.forceRTL + yeniden başlatma uyarısı) artık
 * burada değil, merkezi olarak `useAppLanguage`'da yaşıyor: `changeLang` → i18next
 * `languageChanged` olayı → `syncRtlDirection` (bkz. src/lib/rtl.ts). Böylece hem elle dil
 * seçiminde hem de açılışta otomatik dil algılamasında aynı tek akış çalışır (Faz M1 Task 8).
 * `expo-updates` şu an proje bağımlılığı DEĞİL — bu yüzden gerçek RTL geçişi ancak
 * uygulama tam olarak yeniden açıldığında (Alert'te belirtildiği gibi) yansır.
 */
export function LanguageSwitcher() {
  const { colors } = useTheme()
  const { lang, changeLang } = useAppLanguage()

  const handleSelect = (code: Lang) => {
    if (code === lang) return
    changeLang(code)
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
