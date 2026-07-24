# Faz 1 — Web i18n (TR + AR + EN) + RTL Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (önerilen) veya superpowers:executing-plans ile bu planı görev-görev uygula. Adımlar checkbox (`- [ ]`) ile izlenir.

**Goal:** MedTriage web arayüzünü Türkçe + Arapça + İngilizce'de (Arapça için tam RTL) çalışır hale getirmek; kullanıcı dil tercihini `app_user.language`'da saklamak.

**Architecture:** `i18next` + `react-i18next` ile anahtar-bazlı çeviri; namespace'ler özellik-bazlı JSON bundle. Dil algılama: `app_user.language` → tarayıcı → `tr` fallback. Arapça'da `<html dir="rtl">` + mantıksal Tailwind sınıfları. Tüm sabit metinler `t('ns.key')`'e çıkarılır; TR kaynak, EN+AR bundle'ları TR'den üretilir.

**Tech Stack:** React 19 + Vite + TS + Tailwind 3 + react-i18next; Supabase (app_user migration).

## Global Constraints

- **İşlevsellik/veri akışı BOZULMAZ** — yalnız metin sunumu i18n'e taşınır; mantık, RPC, RLS, rota davranışı değişmez.
- **Kaynak dil TR** — her anahtarın TR değeri, ekrandaki mevcut Türkçe metnin **birebir aynısıdır** (kelimesi kelimesine).
- **Küçük adımlar + doğrulama** — her görev sonunda `npx tsc --noEmit -p tsconfig.app.json` + `npm run build` temiz; ilgili ekran 3 dilde render olur.
- **Erişilebilirlik** — dil değişince `<html lang>` + `dir` güncellenir.
- **Bundle anahtar-paritesi** — TR/EN/AR aynı anahtar setine sahip (otomatik test ile korunur).
- Namespace listesi: `common`, `auth`, `nav`, `requests`, `doctors`, `admin`, `ai`, `activity`.

---

### Task 1: `app_user.language` sütunu + auth bağlamı + kalıcılık

**Files:**
- Create: `supabase/migrations/0041_user_language.sql`
- Modify: `src/lib/auth.tsx` (appUser tipine `language`, context'e ekle)
- Create: `src/features/settings/useSetLanguage.ts`

**Interfaces:**
- Produces: `appUser.language: string` (auth context); `useSetLanguage()` → `mutate(lang: string)`.

- [ ] **Step 1: Migration yaz**

`supabase/migrations/0041_user_language.sql`:
```sql
alter table app_user add column if not exists language text not null default 'tr';
-- Kullanıcı yalnız kendi dilini güncelleyebilir (mevcut app_user RLS update politikası
-- kendini güncellemeye izin veriyorsa ek politika gerekmez; yoksa aşağıdaki RPC kullanılır).
create or replace function set_my_language(p_lang text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_lang not in ('tr','ar','en','ru','de','fr') then
    raise exception 'gecersiz dil';
  end if;
  update app_user set language = p_lang where id = auth.uid();
end $$;
revoke execute on function set_my_language(text) from public, anon;
grant execute on function set_my_language(text) to authenticated;
```

- [ ] **Step 2: Migration'ı uygula** (Supabase MCP `apply_migration`, isim `user_language`). Beklenen: hata yok, `app_user.language` mevcut.

- [ ] **Step 3: auth.tsx'e `language` ekle**

`AppUser` tipine `language: string` ekle; `app_user` select'ine `language` sütununu dahil et; context değerine geç. (Mevcut select `*` ise ek değişiklik gerekmez — doğrula.)

- [ ] **Step 4: useSetLanguage hook'u yaz**

`src/features/settings/useSetLanguage.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export function useSetLanguage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lang: string) => {
      const { error } = await supabase.rpc('set_my_language', { p_lang: lang })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-user'] }),
  })
}
```
(Not: `app-user` query anahtarını auth.tsx'teki gerçek anahtara göre düzelt.)

- [ ] **Step 5: tsc + build** — temiz. **Commit:** `feat(i18n): app_user.language + set_my_language RPC`.

---

### Task 2: i18next kurulumu + sağlayıcı + `<html lang/dir>` senkronu

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/locales/tr/common.json` (iskele)
- Modify: `src/main.tsx`
- Modify: `package.json` (bağımlılıklar)

**Interfaces:**
- Produces: yan-etkili `import './i18n'` i18next'i başlatır; `applyDir(lang)` `<html>` `dir/lang`'ı ayarlar.

- [ ] **Step 1: Bağımlılıkları kur**

Run: `npm i i18next react-i18next i18next-browser-languagedetector`
Beklenen: kurulum başarılı.

- [ ] **Step 2: i18n config yaz**

`src/i18n/index.ts`:
```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import trCommon from './locales/tr/common.json'

export const SUPPORTED = ['tr', 'ar', 'en'] as const
export type Lang = (typeof SUPPORTED)[number]
export const RTL_LANGS = new Set<string>(['ar'])

export function applyDir(lang: string) {
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { tr: { common: trCommon } },
    fallbackLng: 'tr',
    supportedLngs: SUPPORTED as unknown as string[],
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  })

i18n.on('languageChanged', applyDir)
applyDir(i18n.language || 'tr')

export default i18n
```

- [ ] **Step 3: TR common iskelesi**

`src/i18n/locales/tr/common.json`:
```json
{ "actions": { "save": "Kaydet", "cancel": "Vazgeç", "delete": "Sil", "search": "Ara…" } }
```

- [ ] **Step 4: main.tsx'te import et**

`import './index.css'` satırından sonra `import './i18n'` ekle (App'ten önce çalışmalı).

- [ ] **Step 5: tsc + build** — temiz. **Commit:** `feat(i18n): i18next kurulumu + dir/lang senkronu`.

---

### Task 3: Anahtar-paritesi testi + dil senkron köprüsü (app_user ↔ i18next)

**Files:**
- Create: `src/i18n/__tests__/keyParity.test.ts`
- Create: `src/i18n/useAppLanguage.ts`

**Interfaces:**
- Consumes: `appUser.language`, `useSetLanguage`.
- Produces: `useAppLanguage()` → `{ lang, setLang }`; giriş yapan kullanıcının dili i18next'e uygulanır.

- [ ] **Step 1: Başarısız test yaz (anahtar-paritesi)**

`src/i18n/__tests__/keyParity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import tr from '../locales/tr/common.json'
import en from '../locales/en/common.json'
import ar from '../locales/ar/common.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`])
}
describe('i18n key parity', () => {
  it('EN ve AR, TR ile aynı anahtarlara sahip', () => {
    const t = keys(tr).sort()
    expect(keys(en).sort()).toEqual(t)
    expect(keys(ar).sort()).toEqual(t)
  })
})
```

- [ ] **Step 2: Testi çalıştır — FAIL** (`en/common.json`, `ar/common.json` yok). Run: `npx vitest run src/i18n`.

- [ ] **Step 3: EN + AR common iskelesi oluştur** (TR anahtarlarıyla birebir; değerler çevrili)

`src/i18n/locales/en/common.json`:
```json
{ "actions": { "save": "Save", "cancel": "Cancel", "delete": "Delete", "search": "Search…" } }
```
`src/i18n/locales/ar/common.json`:
```json
{ "actions": { "save": "حفظ", "cancel": "إلغاء", "delete": "حذف", "search": "بحث…" } }
```
Ve `src/i18n/index.ts` `resources`'a `en`/`ar` ekle + `ns` aynı kalır.

- [ ] **Step 4: Testi çalıştır — PASS.**

- [ ] **Step 5: useAppLanguage köprüsü**

`src/i18n/useAppLanguage.ts`:
```ts
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { useSetLanguage } from '../features/settings/useSetLanguage'

export function useAppLanguage() {
  const { i18n } = useTranslation()
  const { appUser } = useAuth()
  const setLang = useSetLanguage()

  // Giriş yapan kullanıcının kayıtlı dili i18next'e uygulanır (bir kez, appUser gelince).
  useEffect(() => {
    if (appUser?.language && appUser.language !== i18n.language) {
      i18n.changeLanguage(appUser.language)
    }
  }, [appUser?.language, i18n])

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang)
    if (appUser) setLang.mutate(lang)
  }
  return { lang: i18n.language, changeLang, pending: setLang.isPending }
}
```

- [ ] **Step 6: App.tsx'te köprüyü çağır** — `useAppLanguage()`'i Layout'un içinde/App kökünde bir kez çağır (aşağıdaki Task 4 dil değiştiricisi zaten çağırır; ara adımda App kökünde `useAppLanguage()` çağıran küçük bir bileşen yeterli).

- [ ] **Step 7: tsc + test + build** — temiz. **Commit:** `feat(i18n): anahtar-paritesi testi + app_user↔i18next köprüsü`.

---

### Task 4: Dil değiştirici (Layout header) + nav etiketleri i18n

**Files:**
- Create: `src/components/LanguageSwitcher.tsx`
- Modify: `src/lib/nav.ts` (label → labelKey)
- Modify: `src/components/Layout.tsx`
- Modify: `src/i18n/locales/{tr,en,ar}/nav.json` (create) + i18n `ns`

**Interfaces:**
- Consumes: `useAppLanguage`.
- Produces: `<LanguageSwitcher />`; `NavLink.labelKey`.

- [ ] **Step 1: nav.ts'i labelKey'e çevir**

`NavLink` → `{ to: string; labelKey: string }`; her `label: '...'` → `labelKey: 'nav.<key>'` (ör. `'nav.requests'`, `'nav.newRequest'`, `'nav.pending'`, `'nav.profile'`, `'nav.allRequests'`, `'nav.duplicates'`, `'nav.doctors'`, `'nav.users'`, `'nav.activity'`, `'nav.billing'`).

- [ ] **Step 2: nav.json bundle'ları** (tr/en/ar) — yukarıdaki anahtarların değerleri (TR mevcut etiketlerle birebir). i18n `ns`'e `'nav'` ekle + `resources`'a `nav` yükle.

- [ ] **Step 3: Layout'ta `t` kullan** — `useTranslation()` ile `{t(l.labelKey)}`; sabit "Çıkış" vb. `t('nav.logout')`.

- [ ] **Step 4: LanguageSwitcher yaz**

`src/components/LanguageSwitcher.tsx` — shadcn `DropdownMenu` ile üç dil (TR/العربية/EN); seçince `changeLang(lang)`. Globe ikonu (lucide `Languages`). Layout header'a ThemeToggle yanına ekle.

- [ ] **Step 5: Doğrula (tarayıcı)** — dev sunucu; dil değiştir → nav etiketleri + yön (AR'de rtl) değişir; yenilemede localStorage'dan korunur; giriş yapılıysa `app_user.language` güncellenir (Supabase'de doğrula).

- [ ] **Step 6: tsc + test + build** — temiz. **Commit:** `feat(i18n): dil değiştirici + nav etiketleri`.

---

### Task 5: RTL temeli — mantıksal sınıf sözleşmesi + Layout referans dönüşümü

**Files:**
- Modify: `src/components/Layout.tsx`
- Create: `src/i18n/__tests__/dir.test.ts`
- Create: `docs/superpowers/rtl-conventions.md`

**Interfaces:**
- Produces: RTL sözleşme dokümanı; `applyDir` davranış testi.

- [ ] **Step 1: dir testi yaz — FAIL**

`src/i18n/__tests__/dir.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyDir } from '../index'
describe('applyDir', () => {
  it('ar → rtl, en/tr → ltr', () => {
    applyDir('ar'); expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    applyDir('en'); expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    applyDir('tr'); expect(document.documentElement.getAttribute('dir')).toBe('ltr')
  })
})
```
Run: `npx vitest run src/i18n` → dir.test PASS (applyDir zaten Task 2'de var; test onu doğrular). Test-önce ilkesi için testi commit'ten önce yaz.

- [ ] **Step 2: RTL sözleşmesi dokümanı**

`docs/superpowers/rtl-conventions.md`: `left/right` yerine `start/end` (`ps-/pe-/ms-/me-/text-start/text-end/start-*/end-*`); yön-duyarlı ikonlar (chevron/ok/geri) `rtl:rotate-180` veya koşullu; sabit-yön grafikler (skor barı) nötr bırakılır.

- [ ] **Step 3: Layout'u dönüştür** — Layout'taki `left/right`, `ml-/mr-`, `pl-/pr-`, `text-left/right` → mantıksal karşılıkları. Header, pill nav, mobil alt-nav, çıkış butonu hizası RTL'de doğru.

- [ ] **Step 4: Doğrula (tarayıcı)** — AR seç → header/nav sağdan-sola aynalanır; TR/EN'de değişmez. Ekran görüntüsü.

- [ ] **Step 5: tsc + test + build** — temiz. **Commit:** `feat(i18n): RTL temeli + Layout dönüşümü`.

---

### Task 6 (Prosedür): Ekran string çıkarımı — referans + paylaşılan bileşenler

**Bu görev, kalan ekran görevleri (7-11) için tekrarlanacak prosedürü tanımlar ve paylaşılan bileşenleri çıkarır.**

**Files:**
- Modify: `src/components/ui/EmptyState.tsx`, `PageHeader.tsx`, `StatusPill.tsx`, `Toast.tsx`, `Field.tsx`, `Badge.tsx`, `PhotoUploader.tsx`, `Button.tsx` (loading vb. sabit metin varsa)
- Modify: `src/i18n/locales/{tr,en,ar}/common.json`

**Çıkarım prosedürü (her ekran görevinde uygula):**
1. Ekrandaki her kullanıcıya-görünür sabit dizeyi bul (JSX metni, `placeholder`, `title`, `aria-label`, `alt`, toast mesajları, buton etiketleri).
2. Uygun namespace'te anlamlı bir anahtar seç (`ns.area.key`). TR değeri = mevcut metnin birebiri.
3. Bileşende `const { t } = useTranslation('<ns>')` (veya `useTranslation(['<ns>','common'])`), metni `t('area.key')` ile değiştir. Enterpolasyonlu metinler `t('key', { count })`.
4. Anahtarı TR/EN/AR bundle'larına ekle (EN+AR değerleri çeviri; Task 12'de toplu doğrulanır — ara adımda EN/AR için TR değerini geçici koyup Task 12'de doldurmak yerine, **anahtarı üç bundle'a da hemen ekle**; parite testi yeşil kalır).
5. **Worked example (StatusPill):** durum etiketleri (ör. "Beklemede", "Teklif hazır", "Kapandı") → `common.status.*` anahtarlarına; `StatusPill` `t('status.'+status)` ile render eder.

- [ ] **Step 1:** Prosedürü paylaşılan bileşenlere uygula (yukarıdaki dosyalar). Sabit metinleri `common` namespace'ine çıkar.
- [ ] **Step 2:** Parite testi PASS; `npx tsc` temiz.
- [ ] **Step 3:** Doğrula — bir ekranda StatusPill/EmptyState/PageHeader 3 dilde doğru.
- [ ] **Step 4: build + Commit:** `feat(i18n): paylaşılan bileşen stringleri`.

---

### Task 7: Çıkarım — auth ekranları

**Files:** `src/features/auth/LoginPage.tsx`, `ResetPasswordPage.tsx`; `locales/{tr,en,ar}/auth.json` (create); i18n `ns`+`auth`.

- [ ] **Step 1:** Task 6 prosedürünü uygula. Anahtarlar ör.: `auth.welcomeBack`, `auth.signInSubtitle`, `auth.email`, `auth.password`, `auth.signIn`, `auth.forgot`, `auth.resetTitle`, `auth.valueProps.*`, hata mesajları `auth.errors.*`.
- [ ] **Step 2:** Parite testi PASS; tsc temiz.
- [ ] **Step 3:** Doğrula — Login 3 dilde + AR'de RTL düzgün. Ekran görüntüsü.
- [ ] **Step 4: build + Commit:** `feat(i18n): auth ekranları`.

---

### Task 8: Çıkarım — requests ekranları

**Files:** `RequestList.tsx`, `NewRequestWizard.tsx`, `RequestDetail.tsx`, `PatientInfoCard.tsx`, `DuplicateMatchPanel.tsx`; `locales/{tr,en,ar}/requests.json`.

- [ ] **Step 1:** Prosedürü uygula. Kritik: NewRequestWizard'daki tüm alan etiketleri, placeholder'lar, eksik-alan özet metni, onam metni, kategori/cinsiyet "Seçin" placeholder'ları (katalog **adları** Faz 2'de; buradaki yalnız sabit UI metni). PatientInfoCard alan başlıkları (`Hasta adı`, `Yaş`, `Boy` vb.).
- [ ] **Step 2:** Parite testi PASS; tsc temiz.
- [ ] **Step 3:** Doğrula — Yeni Talep + Talep Detayı 3 dilde. Ekran görüntüsü.
- [ ] **Step 4: build + Commit:** `feat(i18n): requests ekranları`.

---

### Task 9: Çıkarım — doctor ekranları

**Files:** `DoctorQueue.tsx`, `DoctorRequestView.tsx`, `DoctorProfile.tsx`; `locales/{tr,en,ar}/doctors.json`.

- [ ] **Step 1:** Prosedürü uygula (kabul/red butonları, "Tedavi planı"/"Red gerekçesi" etiketleri, profil alanları, yetkinlik/ağırlıklı-iş etiketleri, performans metrik etiketleri).
- [ ] **Step 2:** Parite testi PASS; tsc temiz.
- [ ] **Step 3:** Doğrula — doktor kuyruğu + talep yanıt + profil 3 dilde. Ekran görüntüsü.
- [ ] **Step 4: build + Commit:** `feat(i18n): doctor ekranları`.

---

### Task 10: Çıkarım — admin ekranları

**Files:** `AllRequests.tsx`, `DuplicateReview.tsx`, `DoctorAdmin.tsx`, `DoctorPerformanceDashboard.tsx`, `UserAdmin.tsx`, `Billing.tsx`; `locales/{tr,en,ar}/admin.json`.

- [ ] **Step 1:** Prosedürü uygula (sekmeler, filtre etiketleri, tablo başlıkları, aksiyon menüleri, dialog başlık/alanları, boş-durum/arama metinleri, sayfalama "Toplam N …").
- [ ] **Step 2:** Parite testi PASS; tsc temiz.
- [ ] **Step 3:** Doğrula — Tüm Talepler, Doktor Yönetimi (Doktorlar+Raporlama), Kullanıcı Yönetimi 3 dilde. Ekran görüntüsü.
- [ ] **Step 4: build + Commit:** `feat(i18n): admin ekranları`.

---

### Task 11: Çıkarım — ai + activity

**Files:** `AiPanel.tsx`, `AiAccuracyCard.tsx`, `ActivityTimeline.tsx`; `locales/{tr,en,ar}/ai.json`, `activity.json`.

- [ ] **Step 1:** Prosedürü uygula. **Not:** AI **üretilen** içerik (`suitability_note`, uyarı gerekçeleri) burada ÇEVRİLMEZ — o Faz 3 (içerik çevirisi) kapsamı. Buradaki yalnız sabit UI metni (uyarı **tür başlıkları** `ai.warnings.*`, "otomatik değerlendirme" etiketleri, geri bildirim butonları, doğruluk kartı etiketleri, timeline rol/gün etiketleri).
- [ ] **Step 2:** Parite testi PASS; tsc temiz.
- [ ] **Step 3:** Doğrula — AI paneli + Akış 3 dilde. Ekran görüntüsü.
- [ ] **Step 4: build + Commit:** `feat(i18n): ai + activity ekranları`.

---

### Task 12: EN + AR bundle'larını gözden geçir/tamamla (Claude toplu)

**Files:** `src/i18n/locales/en/*.json`, `src/i18n/locales/ar/*.json`.

- [ ] **Step 1:** Tüm TR bundle'larını referans alarak EN + AR değerlerini gözden geçir. Görevler 6-11 boyunca anahtarlar zaten üç bundle'a eklendi; bu görev **çeviri kalitesini** bütünsel doğrular (tutarlı terminoloji: "talep"=request/طلب, "doktor", "satışçı" vb.). Eksik/zayıf çevirileri düzelt.
- [ ] **Step 2:** Parite testi PASS (anahtar seti aynı). tsc temiz.
- [ ] **Step 3:** Terminoloji tutarlılığı için hızlı gözden geçirme — aynı kavram tüm namespace'lerde aynı çevrilmiş.
- [ ] **Step 4: build + Commit:** `feat(i18n): EN + AR çeviri gözden geçirmesi`.

---

### Task 13: Arapça RTL görsel geçişi + düzeltmeler

**Files:** Görevler 7-11'de dönüştürülen ekranlar (RTL sınıf düzeltmeleri).

- [ ] **Step 1:** AR seç; her ana ekranı gez (Login, Talepler, Yeni Talep, Talep Detayı, Doktor kuyruğu/yanıt/profil, Tüm Talepler, Doktor Yönetimi, Kullanıcı Yönetimi, AI paneli, Akış). Sol/sağ hizalama, ikon yönü, kenar boşluğu, dropdown/dialog konumu kontrol.
- [ ] **Step 2:** Bulunan sabit-yön sınıfları → mantıksal karşılıklar (Task 5 sözleşmesi). Yön-duyarlı ikonlar `rtl:-scale-x-100` / koşullu.
- [ ] **Step 3:** Doğrula — her ekran AR'de tutarlı sağdan-sola. Ekran görüntüleri.
- [ ] **Step 4: tsc + test + build + Commit:** `fix(i18n): Arapça RTL görsel düzeltmeleri`.

---

### Task 14: Faz 1 doğrulama + deploy

- [ ] **Step 1:** `npx tsc --noEmit -p tsconfig.app.json` — temiz.
- [ ] **Step 2:** `npx vitest run` — tüm testler (mevcut 183 + i18n parite + dir) yeşil.
- [ ] **Step 3:** `npm run build` — başarılı.
- [ ] **Step 4:** Tarayıcı e2e: TR↔EN↔AR geçişi kalıcı (localStorage + app_user), giriş sonrası kullanıcı dili uygulanıyor, AR tam RTL. Roller: satışçı + koordinatör + doktor ekranları 3 dilde.
- [ ] **Step 5:** `npm run deploy` → linki paylaş. **Commit** (gerekiyorsa) + faz kapanışı.

---

## Bağımlılık Sırası

Task 1 → 2 → 3 → 4 → 5 (altyapı) → 6 (prosedür + paylaşılan) → 7–11 (ekran çıkarımı, birbirinden bağımsız, paralelleştirilebilir) → 12 (çeviri gözden geçirme) → 13 (RTL geçiş) → 14 (doğrulama/deploy).
