// Sunucudaki dil (app_user.language) ile i18next arasındaki senkron KARARI.
//
// NEDEN AYRI DOSYA: bu karar bir DÖNGÜ hatasına yol açmıştı (bkz. aşağıdaki not) —
// saf fonksiyon olarak test edilebilir olması, aynı hatanın tekrarını önler.
//
// HATA (dil değiştirince uygulama donuyordu): `useAppLanguage` İKİ yerde mount edilir
// (RootNavigator/_layout + LanguageSwitcher). Kullanıcı dil seçtiğinde i18next hemen
// yeni dile geçer, ama auth context'teki `language` sunucudan yeniden okunmadığı için
// ESKİ dilde kalır. Her iki mount'un effect'i de "sunucu dili ≠ i18n dili" görüp dili
// GERİ almaya çalışır; i18next.changeLanguage async olduğundan bu çağrılar yarışır,
// her biri `languageChanged` yayar, bu da yeniden render → yeniden effect → ... şeklinde
// bitmeyen bir ping-pong üretir ve JS iş parçacığını doyurup arayüzü DONDURUR.
//
// KURAL: sunucu dili yalnızca AÇILIŞTA bir kez uygulanır. Kullanıcı elle dil seçtiği
// anda otorite kullanıcıdadır — sunucu değeri artık dili geri alamaz.

export interface ApplyDecision {
  /** i18next.changeLanguage çağrılmalı mı? */
  shouldApply: boolean
  /** "sunucu dili uygulandı" bayrağı bundan sonra true olmalı mı? */
  markApplied: boolean
}

export function decideServerLanguage(input: {
  /** Sunucu dili bu oturumda daha önce uygulandı mı (veya kullanıcı elle seçti mi)? */
  alreadyApplied: boolean
  /** app_user.language (auth context) — henüz yüklenmediyse null */
  serverLanguage: string | null | undefined
  /** i18next'in şu anki dili */
  currentLanguage: string | undefined
}): ApplyDecision {
  // Kullanıcı seçimi yapıldıysa veya sunucu dili zaten uygulandıysa: bir daha dokunma.
  if (input.alreadyApplied) return { shouldApply: false, markApplied: true }
  // Sunucu dili henüz yüklenmediyse bekle (bayrağı da işaretleme).
  if (!input.serverLanguage) return { shouldApply: false, markApplied: false }
  // İlk yükleme: farklıysa uygula, aynıysa yalnız bayrağı işaretle.
  return {
    shouldApply: input.serverLanguage !== input.currentLanguage,
    markApplied: true,
  }
}
