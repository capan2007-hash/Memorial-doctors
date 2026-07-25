// Faz M1 Task 8 — Arapça RTL desteği yardımcıları.
//
// 1) rtlIconStyle: chevron/ok gibi yön-duyarlı SVG ikonları RTL'de yatayda aynalar.
//    RN, flexDirection:'row' ve marginStart/End gibi mantıksal stilleri otomatik çevirir
//    ama bir SVG ikonun kendi çizimini (örn. sola bakan ok) aynalamaz — bunu elle yapmak
//    gerekir (bkz. lucide-react-native ikonları react-native-svg Svg'ye style prop'unu
//    olduğu gibi iletir, dolayısıyla transform:scaleX çalışır).
//
// 2) syncRtlDirection: I18nManager.isRTL yalnızca uygulama TAM olarak yeniden başlatıldığında
//    native tarafta gerçek etkisini gösterir (RN, bu bayrağı JS paketi yüklenirken bir kez
//    okur — bkz. node_modules/react-native/Libraries/ReactNative/I18nManager.js). Bu yüzden
//    hem dil değiştiricide (kullanıcı elle dil seçtiğinde) hem de uygulama açılışında
//    (i18next kayıtlı tercihi veya cihaz dilini çözdüğünde) aynı kontrol/uyarı akışı
//    tek bir yerden çalıştırılır: RTL_LANGS ile I18nManager.isRTL uyuşmuyorsa forceRTL
//    uygulanır ve kullanıcı yeniden başlatması için uyarılır. `expo-updates` proje
//    bağımlılığı değil — bu yüzden otomatik reload YOK, yalnız Alert.
import type { i18n as I18nInstance } from 'i18next'
import { Alert, I18nManager } from 'react-native'

import { RTL_LANGS } from '@/i18n'

export const rtlIconStyle = I18nManager.isRTL ? { transform: [{ scaleX: -1 as const }] } : undefined

export function syncRtlDirection(lang: string, i18n: I18nInstance): void {
  const shouldBeRTL = RTL_LANGS.has(lang)
  if (I18nManager.isRTL === shouldBeRTL) return

  I18nManager.forceRTL(shouldBeRTL)
  Alert.alert(i18n.t('common:language.restartTitle'), i18n.t('common:language.restartMessage'), [
    { text: i18n.t('common:language.restartConfirm') },
  ])
}
