# Mobil — i18n + İçerik Çevirisi + Premium Cilalama Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Adımlar checkbox (`- [ ]`).

**Goal:** Mobil (Expo/RN) uygulamayı web paritesine getir: 6-dil arayüz i18n (TR/AR/EN/RU/DE/FR) + Arapça RTL + görüntüleyene-göre içerik çevirisi + premium tasarım cilalama.

**Architecture:** `react-i18next` + `expo-localization` (cihaz dili); mobil-özgü bundle JSON'ları (kendi ekran anahtarları); `app_user.language` ortak (mevcut `set_my_language` RPC); içerik çevirisi mevcut `translate` edge function'ı çağırır (yeni backend yok); RTL `I18nManager.forceRTL` (Arapça'da yeniden başlatma). Tasarım: mevcut `theme.ts` token'ları üzerine premium cilalama.

**Tech Stack:** Expo SDK 54, expo-router, React Native, react-i18next, expo-localization, @tanstack/react-query, Supabase JS. Test: jest.

## Global Constraints
- İşlevsellik/veri akışı/rota davranışı BOZULMAZ.
- Backend YENİDEN YAZILMAZ — mevcut `translate` fn, `set_my_language` RPC, `content_translation`, katalog `name_i18n` (6 dil) yeniden kullanılır.
- Hasta ad/soyad/telefon/sayı ÇEVRİLMEZ; kategori adları `name_i18n` ile (Faz 2 web deseni).
- TR kaynak; her anahtarın TR değeri mevcut ekran metninin birebiri.
- Her faz sonunda `npx tsc` + `npx jest` temiz.

---

## FAZ M1 — i18n altyapı + string çıkarımı + RTL

### Task 1: Bağımlılıklar + i18n config + auth.language
**Files:** `mobile/package.json`, `mobile/src/i18n/index.ts` (create), `mobile/src/types/db.ts`, `mobile/src/lib/auth.tsx`, `mobile/src/features/settings/useSetLanguage.ts` (create).
- [ ] Kur: `npx expo install expo-localization` + `npm i i18next react-i18next`.
- [ ] `src/i18n/index.ts`: i18next init; `SUPPORTED=['tr','ar','en','ru','de','fr']`; `RTL_LANGS={ar}`; dil algılama: `app_user.language` → `Localization.getLocales()[0].languageCode` → 'tr'; AsyncStorage'da sakla.
- [ ] `types/db.ts` `AppUserRow.language: string`; `auth.tsx` app_user select'i `language` içerir (genelde `*`); `useSetLanguage` (mevcut `set_my_language` RPC).
- [ ] `App`/root layout'ta i18n import + köprü (app_user.language uygulanır).
- [ ] tsc + jest temiz. Commit.

### Task 2: TR bundle iskeleti + parite testi + dil değiştirici
**Files:** `mobile/src/i18n/locales/tr/*.json` (namespace'ler: common, auth, queue, request, profile, admin, ai), `mobile/src/i18n/__tests__/keyParity.test.ts` (create), dil değiştirici (Settings ekranına).
- [ ] Namespace TR JSON'ları (başlangıç: common + auth). Parite testi (baseKeys, çoğul-son-ek sıyırma) — web deseni.
- [ ] Settings/Ayarlar ekranına dil seçici (6 dil, bayraklı: 🇹🇷🇸🇦🇬🇧🇷🇺🇩🇪🇫🇷; `changeLang` → i18next + `set_my_language`). RTL için Arapça seçilince `I18nManager.forceRTL(true)` + `Updates.reloadAsync()`/yeniden başlat uyarısı.
- [ ] tsc + jest temiz. Commit.

### Task 3-6: Ekran-grubu string çıkarımı (TR anahtarları)
Her görev: bir ekran grubunu `t('ns.key')`'e çıkar, TR bundle'a anahtar ekle, tsc + jest temiz, commit. Prosedür web Task 6 ile aynı (placeholder/başlık/Alert dahil).
- [ ] **Task 3 — auth + tabs:** `login.tsx`, `(tabs)/{index,dashboard,history,profile,settings}.tsx`.
- [ ] **Task 4 — request/doktor akışı:** `request/[id].tsx`, `talep/[id].tsx`, `doktor/[id].tsx`, `doktor/yeni.tsx`, `QueueRow`, `PatientInfoCard`, `AiPanel`, `DecisionBadge`, `StatusPill`.
- [ ] **Task 5 — admin:** `(admin)/{talepler,mukerrer,doktorlar,kullanicilar,ayarlar}.tsx`, `kullanici/yeni.tsx`, `ScopeEditor`.
- [ ] **Task 6 — paylaşılan + kalan:** `ui/*`, `EmptyState`, `Avatar`, `Spinner`, `ThemeToggle` + kalan sabit metinler.

### Task 7: AR/EN/RU/DE/FR bundle üretimi (5 dil)
- [ ] TR bundle'larından 5 dile çeviri (web Faz 5 deseni; paralel çeviri agent'ları). Parite testi 6 dil PASS. Katalog adları `name_i18n` ile (zaten 6 dil DB'de). Commit.

### Task 8: RTL görsel geçiş (Arapça)
- [ ] `I18nManager` + mantıksal stiller (RN'de `flexDirection`, `textAlign` yön-duyarlı; `marginStart/End`). Ana ekranlar Arapça'da sağdan-sola. Commit.

---

## FAZ M2 — İçerik çevirisi

### Task 9: source_lang yazımı + useTranslated/TranslatedText (RN)
**Files:** mobil create-request/respond hook'ları (`source_lang: i18n.language`), `mobile/src/features/i18n-content/useTranslated.ts` + `TranslatedText.tsx` (RN — `<Text>` tabanlı, "otomatik çeviri" etiketi + "orijinali göster" dokunuşu).
- [ ] Mobil talep/yanıt oluşturma `source_lang` yazar (web Task 1 deseni; şema zaten canlı).
- [ ] `useTranslated` (web ile aynı sözleşme; `supabase.functions.invoke('translate')`); `TranslatedText` RN bileşeni (Text + Pressable toggle). Kaynak=hedef kısa devre, hata→orijinal, FNV-1a queryKey.
- [ ] jest testi (invoke mock). Commit.

### Task 10: İçerik alanlarına uygula
- [ ] `PatientInfoCard` (notlar/tıbbi geçmiş, req.source_lang), `request/[id]`/`talep/[id]` tedavi planı (response.source_lang), `AiPanel` (suitability_note + rationale, "tr"), doktor unvan/branş ("tr" compact). tsc + jest temiz. Commit.

---

## FAZ M3 — Premium tasarım cilalama

### Task 11-13: Ekran-grubu premium cila
Mevcut `theme.ts` token'ları üzerine web premium hissini getir: gölgeli kartlar, ferah aralık, durum pill'leri, skeleton yükleme, premium giriş, avatarlı listeler. Her görev bir ekran grubu; görsel doğrulama iOS simülatör (controller).
- [ ] **Task 11 — giriş + kuyruk/liste ekranları** (login, tabs, talepler).
- [ ] **Task 12 — detay + AI + profil ekranları.**
- [ ] **Task 13 — admin ekranları** (doktorlar/kullanıcılar/mükerrer + raporlama benzeri).

### Task 14: Doğrulama
- [ ] tsc + jest tümü yeşil; iOS simülatör turu (TR/AR/EN + bir içerik-çeviri akışı); Arapça RTL. Commit + push.

## Bağımlılık Sırası
M1 (Task 1→2→3-6 paralel→7→8) → M2 (9→10) → M3 (11-13→14). M2, M1 Task 1 (source_lang şeması zaten canlı) + Task 9'a; M3 bağımsız (M1 sonrası).
