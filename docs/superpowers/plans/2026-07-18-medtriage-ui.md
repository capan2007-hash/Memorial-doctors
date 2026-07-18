# MedTriage UI Yenileme ("Klinik Güven") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tüm arayüzü "Klinik Güven" tasarım sistemiyle (teal+amber, Fraunces + Plus Jakarta Sans) yeniden giydirmek; UX düzeltmeleri (etiketli alanlar, renkli durumlar, hasta-adlı listeler, lightbox, toast, boş durumlar, doktor mobil alt çubuk) ve talep formu taslak koruması eklemek. **İş mantığı/RLS/rotalar/doğrulama değişmez.**

**Architecture:** Önce design token'ları + `src/components/ui/` sunum bileşeni katmanı kurulur (TDD ile davranışlı olanlar: Toast, draft store, timeAgo). Sonra ekranlar bu katmanla yeniden giydirilir. Veri değişiklikleri yalnız GÖSTERİM için ek isim/tarih sorgularıdır (listelere hasta/kategori adı).

**Tech Stack:** Mevcut: React 18 + Vite + TS + Tailwind v3 + TanStack Query + Vitest + Playwright. Yeni bağımlılık YOK (fontlar Google Fonts CSS import).

## Global Constraints

- İş mantığı, hook veri akışları (yeni salt-okunur alan eklemek serbest), RLS, rotalar, `canSubmit`/`demographicsError` doğrulama kuralları, FR-21 sınırı DEĞİŞMEZ.
- Arayüz Türkçe; kod/identifier İngilizce.
- Mevcut input `placeholder`'ları KORUNUR (E2E `getByPlaceholder` kullanıyor); `Field` etiketleri EK olarak gelir. Wizard'da Cinsiyet select'i DOM'da Kategori select'inden ÖNCE kalır (E2E `nth(0)/nth(1)`).
- E2E assertion'ları zayıflatılmaz; Task 12'de selector'lar etikete taşınır.
- Renkler/typography yalnız token'lardan (bkz. Task 1) — ekranlarda ham hex yazılmaz (`bg-brand-600` gibi sınıflar).
- Commit: Türkçe conventional; sonunda `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Dosya Yapısı

```
tailwind.config.js               # theme extension (MODIFY)
src/index.css                    # font import + CSS değişkenleri + base (MODIFY)
src/lib/format.ts                # timeAgo() (NEW, TDD)
src/lib/nav.ts                   # (var) — değişmez
src/components/ui/
  Button.tsx  Field.tsx  Card.tsx  StatusPill.tsx  EmptyState.tsx
  Spinner.tsx  Toast.tsx  PhotoGrid.tsx  PageHeader.tsx  Avatar.tsx   (NEW)
src/components/Layout.tsx        # logo + aktif nav + doktor mobil alt çubuk (REWRITE)
src/components/StatusPill.tsx    # SİLİNİR → ui/StatusPill.tsx (import güncellemeleri)
src/features/requests/requestDraft.ts   # in-memory taslak deposu (NEW, TDD)
src/features/requests/NewRequestWizard.tsx  # bölümlenmiş + Field + taslak (REWRITE görünüm)
src/features/requests/RequestList.tsx / RequestDetail.tsx / PatientInfoCard.tsx (RESTYLE)
src/features/requests/useRequests.ts    # liste sorgusuna hasta/kategori adı (EXTEND)
src/features/doctor/DoctorQueue.tsx / DoctorRequestView.tsx (RESTYLE)
src/features/doctor/useMyDoctorId.ts    # DoctorQueue'dan çıkarılır (NEW)
src/features/admin/DoctorAdmin.tsx / AllRequests.tsx (RESTYLE)
src/features/auth/LoginPage.tsx          # split ekran (REWRITE)
src/App.tsx                       # ToastProvider sarmalama (MODIFY)
tests/e2e/core-flow.spec.ts       # etiket-bazlı selector'lar (Task 12)
```

---

## Task 1: Design token'ları + fontlar

**Files:** Modify `tailwind.config.js`, `src/index.css`

- [ ] **Step 1:** `tailwind.config.js` theme extension:
```js
theme: {
  extend: {
    colors: {
      brand: { 50:'#F0FDFA', 100:'#CCFBF1', 600:'#0F766E', 700:'#115E59' },
      accent: { 100:'#FEF3C7', 600:'#D97706', 700:'#B45309' },
      surface: { DEFAULT:'#F8FAFC', card:'#FFFFFF' },
    },
    fontFamily: {
      display: ['Fraunces','Georgia','serif'],
      sans: ['"Plus Jakarta Sans"','system-ui','sans-serif'],
    },
    boxShadow: { card: '0 1px 3px rgba(15,23,42,.08), 0 4px 12px rgba(15,23,42,.05)' },
  },
}
```
- [ ] **Step 2:** `src/index.css` başına (tailwind direktiflerinden önce) font import + base:
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
```
`@layer base` içinde: `body { @apply bg-surface font-sans text-slate-800; }` ve `h1,h2,h3 { @apply font-display; }`. Eski scaffold CSS artıkları (varsa `#root`, demo stilleri) temizlenir.
- [ ] **Step 3:** `npm run build` + `npm run test` temiz; tarayıcıda fontların yüklendiği görülür (controller).
- [ ] **Step 4:** Commit `feat: Klinik Güven design token'ları + tipografi`.

## Task 2: Çekirdek UI bileşenleri (Button, Field, Card, StatusPill, Spinner, EmptyState, PageHeader, Avatar)

**Files:** Create `src/components/ui/{Button,Field,Card,StatusPill,Spinner,EmptyState,PageHeader,Avatar}.tsx`; Delete `src/components/StatusPill.tsx` (importlar `../components/ui/StatusPill`e güncellenir)

**Interfaces (Produces):**
```tsx
Button: { variant?: 'primary'|'secondary'|'danger'|'ghost'; loading?: boolean } & ButtonHTMLAttributes
Field:  { label: string; hint?: string; error?: string; children: ReactNode }  // children'ı <label> ile SARAR (implicit association → getByLabel çalışır)
Card:   { title?: string; children; className? }
StatusPill: { status: RequestStatus }  // renk haritası: draft/submitted=slate, assigned=blue, in_review=indigo, offers_ready=brand(teal), escalated=accent(amber), closed=slate koyu
Spinner: {} · EmptyState: { title: string; description?: string; action?: ReactNode }
PageHeader: { title: string; subtitle?: string; actions?: ReactNode }
Avatar: { src?: string|null; name: string; size?: 'sm'|'md'|'lg' }  // src yoksa baş harfler, brand-100 zemin
```
- [ ] **Step 1:** Bileşenleri yaz. Button: `bg-brand-600 hover:bg-brand-700` (primary), loading'de `Spinner` + disabled. Field: `<label class="block space-y-1"><span class="text-sm font-medium text-slate-700">{label}</span>{children}{error && <p class="text-sm text-red-600">}{hint && ...}</label>`. StatusPill: mevcut Türkçe etiket haritası korunur + renk haritası.
- [ ] **Step 2:** Birim test `src/components/ui/__tests__/ui.test.tsx` (testing-library): Field etiketi input'la ilişkili (`getByLabelText`), Button loading'de disabled, StatusPill her durumda doğru etiket render eder, Avatar src'siz baş harf üretir ("Op. Dr. Plastik" → "OP"? kural: ilk iki kelimenin baş harfleri).
- [ ] **Step 3:** RED→GREEN, `npm run test` tümü yeşil, build temiz. StatusPill importları güncellenir (RequestList, RequestDetail, DoctorQueue, AllRequests).
- [ ] **Step 4:** Commit `feat: çekirdek UI bileşen katmanı (Button/Field/Card/StatusPill/...)`.

## Task 3: Toast + PhotoGrid(lightbox) + timeAgo

**Files:** Create `src/components/ui/Toast.tsx`, `src/components/ui/PhotoGrid.tsx`, `src/lib/format.ts` (+testler); Modify `src/App.tsx` (ToastProvider)

**Interfaces (Produces):**
```tsx
ToastProvider ({children}) — App'te en dışta; useToast(): { show(message: string, kind?: 'success'|'error') }  // 4sn auto-dismiss, sağ-alt sabit
PhotoGrid: { urls: string[]; title?: string; emptyText?: string }  // aspect-square grid (2-4 kolon responsive), tıkla → tam ekran overlay (ESC/tıkla kapat), img alt={title}
timeAgo(iso: string, now?: Date): string  // <60sn 'az önce', <60dk 'N dk önce', <24sa 'N sa önce', <7g 'N gün önce', değilse 'DD.MM.YYYY'
```
- [ ] **Step 1:** TDD: `src/lib/__tests__/format.test.ts` (timeAgo 5 durum, `now` parametresiyle deterministik) + `src/components/ui/__tests__/toast.test.tsx` (show → mesaj görünür; kind=error kırmızı sınıf) RED.
- [ ] **Step 2:** Implementasyon; PhotoGrid lightbox'ı `useState<string|null>` + fixed overlay; `useEffect` ESC dinleyici.
- [ ] **Step 3:** GREEN; App.tsx `<ToastProvider>` sarmalar; build temiz.
- [ ] **Step 4:** Commit `feat: Toast, PhotoGrid(lightbox), timeAgo`.

## Task 4: Layout yenileme (logo, aktif nav, doktor mobil alt çubuk, bekleyen rozeti)

**Files:** Rewrite `src/components/Layout.tsx`; Create `src/features/doctor/useMyDoctorId.ts` (DoctorQueue'daki local hook buraya taşınır, DoctorQueue import eder)

- [ ] **Step 1:** `useMyDoctorId`'yi çıkar (davranış aynı; DoctorQueue + Layout kullanır).
- [ ] **Step 2:** Layout: header `bg-brand-700 text-white`; sol: inline SVG monogram (rounded-lg teal-100 zemin içinde "M+" — basit `<svg>`) + "MedTriage" `font-display`. Orta: `navLinks(role)` — aktif link `border-b-2 border-white/80 font-semibold` (`useLocation` ile). Sağ: kullanıcı adı + Çıkış. **Doktor + mobil (<md):** header nav gizlenir; `fixed bottom-0` alt çubuk (`Bekleyen Talepler` ikon+etiket, bekleyen sayısı `usePendingCount` amber rozet). Ana içerik `pb-20 md:pb-4` (alt çubuk payı). Doktor desktop'ta da nav linkinde amber sayaç rozeti.
- [ ] **Step 3:** Build + tüm testler; controller tarayıcıda 3 rolde (sales/doktor/koordinatör, desktop+375px) doğrular.
- [ ] **Step 4:** Commit `feat: Layout — logo, aktif nav, doktor mobil alt çubuk + bekleyen rozeti`.

## Task 5: Login split ekran

**Files:** Rewrite `src/features/auth/LoginPage.tsx`

- [ ] **Step 1:** `md:grid-cols-2` split: sol panel `bg-brand-700` (logo büyük, "MedTriage" `font-display text-3xl`, alt satır "Estetik cerrahi talep yönetimi & triyaj"); mobilde sol panel üst bant olur. Sağ: `Card` içinde `Field`'li form (E-posta/Şifre — placeholder'lar korunur), `Button` primary loading'li, hata `Field error` ile. Giriş akışı/davranış aynen.
- [ ] **Step 2:** Build/test; controller login akışını canlı doğrular (E2E de kullanıyor).
- [ ] **Step 3:** Commit `feat: login split ekran`.

## Task 6: Talep formu taslak deposu (in-memory)

**Files:** Create `src/features/requests/requestDraft.ts` + `__tests__/requestDraft.test.ts`; Modify `src/features/requests/NewRequestWizard.tsx` (yalnız taslak bağlama — restyle Task 7'de)

**Interfaces (Produces):**
```ts
interface RequestDraft { first,last,age,weightKg,heightCm: string; gender: ''|'female'|'male'|'other';
  pastSurgeries,knownConditions,medications: {none:boolean;text:string};
  categoryId: string; subcategoryId: string|null; operationTypeId: string|null;
  notes: string; files: File[]; xrayFiles: File[] }
saveDraft(d): void · loadDraft(): RequestDraft|null · clearDraft(): void · isDraftEmpty(d): boolean
```
- [ ] **Step 1:** TDD store testleri: save→load aynı referans alanlar; clear→null; isDraftEmpty (tüm string alanlar boş + none'lar false + dosyalar boş → true). RED→GREEN.
- [ ] **Step 2:** Wizard bağlama: state başlangıçları `loadDraft()`'tan (varsa); tüm alan state'leri bir `ref`'te güncel tutulur ve **unmount cleanup'ında** `isDraftEmpty` değilse `saveDraft` çağrılır; başarılı gönderimde (`nav` veya zero-doctor warn'dan önce) `clearDraft()`. Taslak geri yüklendiyse üstte bilgi satırı: "Kaydedilmemiş taslak geri yüklendi." + `Taslağı temizle` ghost buton (clearDraft + state sıfırla).
- [ ] **Step 3:** Doğrula: birim testler; canlı (controller): formu doldur → Talepler'e git → geri dön → değerler duruyor; gönder → tekrar aç → boş.
- [ ] **Step 4:** Commit `feat: talep formu in-memory taslak koruması`.

## Task 7: NewRequestWizard restyle (bölümlenmiş kartlar + Field + eksik özeti)

**Files:** Rewrite render of `src/features/requests/NewRequestWizard.tsx`

- [ ] **Step 1:** `PageHeader "Yeni Talep"`; `max-w-4xl`. Kartlar: **Hasta Bilgileri** (Ad/Soyad `md:grid-cols-2`; Yaş/Cinsiyet/Boy/Kilo `md:grid-cols-4`, hepsi `Field` ile — **Cinsiyet select'i DOM'da Kategori'den önce kalır**), **Tıbbi Geçmiş** (3 alan: `Field` başlık + "Yok" checkbox satırı + koşullu textarea), **Operasyon** (Kategori/Alt kırılım/Operasyon tipi `Field`'li), **Fotoğraflar** (PhotoUploader — seçilen dosyaların isim/önizleme listesi; Diş'te ayrı "Diş Röntgeni" kartı). Placeholder'lar aynen korunur.
- [ ] **Step 2:** Alt sabit bant (`sticky bottom-0` kart, doktor alt çubuğuyla çakışmaz — bu sayfa sales/agent): solda **eksik alan özeti** (canSubmit false iken eksiklerin Türkçe listesi: "Eksik: Ad, Fotoğraf…" — mevcut canSubmit koşullarından türetilen saf `missingFields()` yardımıcı, birim test), sağda `Button primary loading` Gönder. `demoError`/`submitErr`/`warn` mesajları bant üstünde.
- [ ] **Step 3:** Birim test: `missingFields` (3 senaryo). Build/test + controller canlı: 1.65 hatası hâlâ görünür, gönderim çalışır, E2E hâlâ yeşil (placeholder + select sırası korundu).
- [ ] **Step 4:** Commit `feat: talep formu bölümlenmiş yeni tasarım + eksik alan özeti`.

## Task 8: Talep listeleri (RequestList + AllRequests) zengin satırlar

**Files:** Modify `src/features/requests/useRequests.ts` (`useMyRequests` genişler), `src/features/requests/RequestList.tsx`, `src/features/admin/AllRequests.tsx`

- [ ] **Step 1:** `useMyRequests` (ve AllRequests'in sorgusu): request listesine ek olarak tenant'ın `patient(id,first_name,last_name)` ve `category(id,name)` listelerini paralel çekip client-side map'le — satır başına `patientName`, `categoryName`. (RLS zaten izin veriyor; davranış değişmez.)
- [ ] **Step 2:** Satır tasarımı (her ikisi): tıklanabilir kart-satır → `Avatar(name)` + **hasta adı** (semibold) + altında `categoryName · timeAgo(created_at)` + sağda `StatusPill` (+ AllRequests'te `status==='submitted'` ise amber "Doktor atanmadı" rozeti ve `Yeniden ata` `Button secondary`). UUID gösterilmez. Boş listede `EmptyState` ("Henüz talep yok" + sales/agent için "Yeni Talep" aksiyonu). Yüklenmede `Spinner`.
- [ ] **Step 3:** Reassign sonrası `useToast` ("Talep yeniden atandı"). Build/test; controller canlı doğrular.
- [ ] **Step 4:** Commit `feat: talep listeleri — hasta adlı zengin satırlar + boş durumlar`.

## Task 9: Talep detayı + doktor görünümü restyle

**Files:** Modify `src/features/requests/PatientInfoCard.tsx`, `RequestDetail.tsx`, `src/features/doctor/DoctorRequestView.tsx`

- [ ] **Step 1:** `PatientInfoCard`: `Card` içinde **sol-hizalı** `sm:grid-cols-2` tanım listesi (`<dt>` küçük gri, `<dd>` normal); BMI değeri `bg-brand-100 text-brand-700` rozet; boş değerler soluk "Belirtilmedi"; tıbbi alanlar tam genişlik satırlar.
- [ ] **Step 2:** Başlıklar: `PageHeader` — "**{patientName} — {operationName||subcategoryName||categoryName}**", subtitle: `Talep #{kısa-id} · {timeAgo}`; yanında StatusPill. Fotoğraflar/röntgen `PhotoGrid` (lightbox). RequestDetail'de doktor teklifleri: her yanıt `Card` (Avatar+doktor, plan metni); aracı nötr mesajı `EmptyState` görünümünde. **RoleGate'ler aynen.**
- [ ] **Step 3:** DoctorRequestView aksiyonları: **mobilde `fixed bottom-0` çubuk** (Kabul `Button primary` / Red `Button danger` yan yana; içerik `pb-24`), desktop'ta içerik sonunda; kabul/red panelleri `Field`'li `Card`; yanıt başarısında `useToast('Yanıtınız kaydedildi')`, hatada toast error (mevcut respErr korunur). Davranış (useRespond, seen_at) aynen.
- [ ] **Step 4:** Build/test + controller canlı (doktor mobil 375px dahil). Commit `feat: talep detayı & doktor görünümü yeni tasarım`.

## Task 10: Doktor kuyruğu WhatsApp-benzeri liste

**Files:** Modify `src/features/doctor/DoctorQueue.tsx`

- [ ] **Step 1:** Sorguyu hasta/kategori adlarıyla zenginleştir (Task 8 desenini kullan; assignment listesindeki request'ler için). Satır: `Avatar(patientName)` + hasta adı (**görülmemişse** — ilgili assignment `seen_at IS NULL` — `font-semibold` + sol kenarda brand nokta) + alt satır `categoryName · timeAgo(assigned_at)` + sağda StatusPill. Tüm satır tıklanabilir. Boşsa `EmptyState('Bekleyen talep yok')`.
- [ ] **Step 2:** `seen_at` bilgisi için assignment'ları da map'e taşı (zaten çekiliyor). Başlık `PageHeader 'Bekleyen Talepler'` + amber sayaç. Build/test + canlı.
- [ ] **Step 3:** Commit `feat: doktor kuyruğu WhatsApp-benzeri satırlar`.

## Task 11: Doktor yönetimi restyle (liste + dialog + istatistik kutuları)

**Files:** Modify `src/features/admin/DoctorAdmin.tsx`

- [ ] **Step 1:** Sayfa `PageHeader 'Doktor Yönetimi'` + sağda `Yeni Doktor` `Button primary` → **dialog** (fixed overlay + `Card max-w-2xl`, ESC/kapat): mevcut yeni-doktor formu `Field`'lerle bölümlenmiş (Hesap / Profil / Yetkinlikler / Ağırlıklı işler), oluşturunca toast + kapan.
- [ ] **Step 2:** Doktor listesi: `Card` satır — `Avatar(photo|name)` + unvan/branş + yetkinlik **çipleri** (`bg-brand-50 text-brand-700 rounded-full text-xs`) + aktif/pasif durumu; genişleyince düzenleme formu (`Field`'li) + **istatistik kutuları** 4'lü grid (`Kabul / Red / Ort. dönüş / Skor` — büyük sayı + küçük etiket, `Card`), kaydette toast. Davranış (useDoctors hook'ları) aynen.
- [ ] **Step 3:** Build/test + canlı. Commit `feat: doktor yönetimi — liste, dialog form, istatistik kutuları`.

## Task 12: E2E sağlamlaştırma + tam doğrulama

**Files:** Modify `tests/e2e/core-flow.spec.ts`

- [ ] **Step 1:** Selector'ları `Field` etiketlerine taşı: `getByLabel('Yaş')` vb.; combobox'lar `getByLabel('Cinsiyet')/getByLabel('Kategori')` (Field-sarmalı select'ler implicit label ile bulunur) — pozisyonel `nth()` kalkar. FR-21 assertion aynı kalır.
- [ ] **Step 2:** `npm run e2e` GEÇER; `npm run test` (tüm birimler) geçer; `npm run build` temiz.
- [ ] **Step 3:** Controller tam tur canlı doğrulama: login→talep(taslak dahil)→doktor(mobil)→satışçı planı→koordinatör; desktop+375px ekran görüntüleri.
- [ ] **Step 4:** Commit `test: E2E etiket-bazlı selector'lar + UI doğrulaması`.

---

## Self-Review Notları
- Spec §2 token'lar→T1 · §3 bileşenler→T2-3, Layout→T4 · §4 login→T5, form→T7, listeler→T8, detay/doktor→T9, kuyruk→T10, admin→T11 · §5 taslak→T6 · §6 garantiler→Global Constraints (placeholder+select sırası korunur, T12'ye kadar E2E yeşil) · §7 doğrulama→T12. ✅
- Tip tutarlılığı: Field/Button/StatusPill API'leri T2'de tanımlı, sonraki task'lar aynı imzaları kullanıyor; RequestDraft T6'da tanımlı. ✅
