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
//
// ÖNEMLİ (Task M1-8 düzeltmesi): bu dosya, i18next `languageChanged` olayına TEK bir
// modül-seviyesi dinleyici kaydeder (aşağıda, dosya import edildiği anda bir kez).
// Önceden bu abonelik `useAppLanguage` hook'unun içindeydi; hook hem RootNavigator'da
// (her zaman mount) hem LanguageSwitcher'da (Ayarlar ekranında da mount) çağrıldığından
// aynı olay için İKİ dinleyici birden tetikleniyor, bu da forceRTL + "yeniden başlat"
// Alert'inin ÇİFT görünmesine yol açıyordu. Artık bu modül tek sorumlu: kaç yerden
// import edilirse edilsin (ES modülleri singleton'dır) dinleyici bir kez kaydedilir.
import { Alert, I18nManager } from 'react-native'

import i18n, { RTL_LANGS } from '@/i18n'

export const rtlIconStyle = I18nManager.isRTL ? { transform: [{ scaleX: -1 as const }] } : undefined

// Bir oturumda (JS bundle yeniden başlatılana kadar) yeniden-başlatma uyarısı yalnız BİR
// kez gösterilir — I18nManager.isRTL runtime'da forceRTL sonrası güncellenmediği için
// (yukarıdaki not) aynı oturumda dil ileri-geri değiştirilse bile kullanıcı tekrar tekrar
// uyarılmaz.
let restartWarningShownThisSession = false

export function syncRtlDirection(lang: string): void {
  const shouldBeRTL = RTL_LANGS.has(lang)
  if (I18nManager.isRTL === shouldBeRTL) return

  I18nManager.forceRTL(shouldBeRTL)
  if (restartWarningShownThisSession) return
  restartWarningShownThisSession = true
  Alert.alert(i18n.t('common:language.restartTitle'), i18n.t('common:language.restartMessage'), [
    { text: i18n.t('common:language.restartConfirm') },
  ])
}

// Modül-seviyesi TEK abonelik: kaç bileşen `useAppLanguage`'ı mount ederse etsin,
// RTL senkronu yalnızca burada, bir kez çalışır. Ayrıca modül yüklenir yüklenmez
// (açılışta) mevcut i18n diliyle bir kez senkron dener — i18next'in async dil
// dedektörü henüz çözülmemişse bu no-op olur, çözüldüğünde de zaten `languageChanged`
// dinleyicisi devreye girer (bkz. node_modules/i18next dist: changeLanguage her zaman
// `languageChanged` emit eder, ilk çözümleme dahil).
i18n.on('languageChanged', (lng: string) => syncRtlDirection(lng))
if (i18n.language) syncRtlDirection(i18n.language)
