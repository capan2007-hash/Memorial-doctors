# Faz 3 — Görüntüleyene Göre İçerik Çevirisi Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Adımlar checkbox (`- [ ]`).

**Goal:** Kullanıcıların girdiği serbest-metin içeriği (hasta notları, tıbbi geçmiş, tedavi planı, red gerekçesi, AI notları) her okuyucuya **kendi arayüz dilinde** göster — Claude API ile okuma-anında çeviri + önbellek + "orijinali göster" geçişi. Çift yön: AR satışçı içeriği TR doktora TR; TR doktor yanıtı AR satışçıya AR.

**Architecture:** Yazma-anında `source_lang` (yazarın arayüz dili) kaydedilir. `translate` edge function (verify_jwt, Claude API) önce `content_translation` önbelleğini (service-role) kontrol eder, yoksa çevirir+önbelleğe yazar. Client `useTranslated(text, sourceLang)` hook'u hedef≠kaynak ise function'ı çağırır (React Query önbellekli). `TranslatedText` bileşeni çevrilmiş metin + "otomatik çeviri" etiketi + "orijinali göster" gösterir.

**Tech Stack:** Supabase (migration + edge function/Deno + Anthropic SDK), React + react-i18next + react-query. Çeviri modeli: `claude-sonnet-5` (tıbbi kalite/maliyet dengesi).

## Global Constraints
- İşlevsellik/veri akışı/RLS BOZULMAZ.
- Hasta ad/soyad, telefon, e-posta, sayısal değerler ÇEVRİLMEZ.
- **AI ÜRETİLEN içerik (suitability_note, rationale) kanonik TR üretilir; okuma-anında diğer içerik gibi çevrilir** (Faz 1'de dokunulmamıştı — Faz 3'te TranslatedText'e sarılır).
- `content_translation` tablosuna DOĞRUDAN CLIENT ERİŞİMİ YOK (yalnız edge function, service-role).
- Kaynak metin == okuyucu dili ise çeviri çağrısı YAPILMAZ (düz metin).
- Edge function: üst-düzey try/catch + her yanıtta CORS başlıkları (aksi halde CORS'suz 500).

---

### Task 1: Şema — source_lang + content_translation + client yazımı

**Files:** Create `supabase/migrations/0043_content_translation.sql`; Modify `src/types/db.ts`, `src/features/requests/useRequests.ts` (useCreateRequest), `src/features/doctor/useRespond.ts`.

- [ ] **Step 1: Migration yaz** (controller uygular):
```sql
alter table request add column if not exists source_lang text not null default 'tr';
alter table response add column if not exists source_lang text not null default 'tr';

create table if not exists content_translation (
  id uuid primary key default gen_random_uuid(),
  source_hash text not null,
  source_lang text not null,
  target_lang text not null,
  translated_text text not null,
  created_at timestamptz not null default now(),
  unique (source_hash, target_lang)
);
alter table content_translation enable row level security;
-- Doğrudan client erişimi yok: hiçbir policy tanımlanmaz → authenticated/anon 0 satır.
-- Edge function service-role ile erişir (RLS bypass).
```
- [ ] **Step 2: Controller `apply_migration`** (isim `content_translation`). Doğrula: 2 sütun + tablo + RLS enabled.
- [ ] **Step 3: Tipler** — `src/types/db.ts`: `RequestRow.source_lang: string`, `ResponseRow.source_lang: string`, yeni `ContentTranslationRow`.
- [ ] **Step 4: Client yazımı** — `useCreateRequest` insert'ine `source_lang: input.sourceLang` ekle; `CreateRequestInput`'a `sourceLang: string`; `NewRequestWizard` çağrısında `sourceLang: i18n.language` geçir. `useRespond` insert'ine `source_lang: input.sourceLang`; `RespondInput`'a `sourceLang`; `DoctorRequestView` `doRespond`'da `sourceLang: i18n.language`.
- [ ] **Step 5: tsc + build** temiz. **Commit:** `feat(i18n): source_lang + content_translation şema + client yazımı`.

---

### Task 2: `translate` edge function (Claude API + önbellek)

**Files:** Create `supabase/functions/translate/index.ts`.

**Interfaces:** POST `{ text: string, source_lang: string, target_lang: string }` → `{ translated: string, cached: boolean }`.

- [ ] **Step 1: Function yaz** — `ai-triage`/`duplicate-vision` desenini izle (`import Anthropic from 'npm:@anthropic-ai/sdk'`, `import { createClient } from 'npm:@supabase/supabase-js'`, CORS sabitleri). Akış:
  1. OPTIONS → CORS 200.
  2. JWT doğrula (verify_jwt=true; Authorization header'dan Supabase client kur — kimliği doğrulanmış klinik personeli).
  3. `text` boş veya `source_lang === target_lang` → `{ translated: text, cached: true }` (kısa devre).
  4. `source_hash = sha256(text)` (Deno `crypto.subtle`).
  5. Service-role client (`SUPABASE_SERVICE_ROLE_KEY`) ile `content_translation` (source_hash, target_lang) sorgula → varsa `{ translated, cached: true }`.
  6. Yoksa Claude: `model: 'claude-sonnet-5'`, sistem prompt'u "Sen tıbbi/klinik metin çevirmenisin. Verilen metni {source}→{target} diline çevir; TIBBİ TERİMLERİ doğru koru; ekstra açıklama/ön-söz ekleme, yalnız çeviriyi döndür." `max_tokens` metne oranlı (ör. 2000). Boyut sınırı: `text.length > 5000` → 400.
  7. Sonucu `content_translation`'a `insert` (çakışmada yok say: `upsert onConflict source_hash,target_lang` veya insert+ignore) → `{ translated, cached: false }`.
  8. Üst-düzey try/catch → hata da CORS başlıklı JSON.
- [ ] **Step 2: Controller deploy** (`deploy_edge_function` verify_jwt=true). Smoke: geçerli JWT ile `{text:'Merhaba, hasta sigara içiyor', source_lang:'tr', target_lang:'ar'}` → Arapça döner; ikinci çağrı `cached:true`.
- [ ] **Step 3:** (kod tarafı) Function TS'i tsc gerektirmez (Deno); ama `npm run build` (web) etkilenmez — doğrula. **Commit:** `feat(i18n): translate edge function (Claude API + önbellek)`.

---

### Task 3: `useTranslated` hook + `TranslatedText` bileşeni

**Files:** Create `src/features/i18n-content/useTranslated.ts`, `src/features/i18n-content/TranslatedText.tsx`. (i18n bundle: `common` ns'ine `autoTranslated`, `showOriginal`, `showTranslation` anahtarları tr/en/ar.)

**Interfaces:** `useTranslated(text: string|null, sourceLang: string) → { text: string, isTranslated: boolean, isLoading: boolean }`. `<TranslatedText text sourceLang className />`.

- [ ] **Step 1: Hook yaz** — `const { i18n } = useTranslation()`; hedef=`i18n.language`. `!text || target===sourceLang` → `{ text, isTranslated:false }`. Aksi halde React Query (`['translate', hash(text), target]`) ile `supabase.functions.invoke('translate', { body })` çağır; dönerken `{ text: data.translated, isTranslated:true }`. Yükleniyorsa `isLoading:true` + orijinali göster (placeholder yerine).
- [ ] **Step 2: `TranslatedText` bileşeni** — hook'u kullan; `isTranslated` ise: çevrilmiş metin + küçük **"otomatik çeviri"** etiketi (`common.autoTranslated`) + **"orijinali göster"/"çeviriyi göster"** geçiş butonu (yerel `showOriginal` state). Kaynak=hedef ise düz metin (etiket yok). Yükleniyorsa hafif opaklık + orijinal.
- [ ] **Step 3:** i18n `common.json` (tr/en/ar) anahtarları + parite. Test: kaynak=hedef ise düz metin döndürür (hook birim testi, invoke mock'lu).
- [ ] **Step 4: tsc + test + build** temiz. **Commit:** `feat(i18n): useTranslated hook + TranslatedText bileşeni`.

---

### Task 4: İçerik alanlarına TranslatedText uygula + source_lang taşı

**Files:** Modify `PatientInfoCard.tsx`, `RequestDetail.tsx`, `DoctorRequestView.tsx`, `AiPanel.tsx`, `DuplicateReview.tsx` (+ `useRequests.ts`/ilgili sorgular `source_lang` çeksin).

- [ ] **Step 1: Sorgulara `source_lang` ekle** — request (notes/past_surgeries/medications kaynağı) `source_lang`'ı, response (treatment_plan/reject_reason) `source_lang`'ı çekilsin ve ilgili gösterime taşınsın. AI `ai_evaluation` içeriği kanonik `tr` kabul edilir (sabit `sourceLang="tr"`).
- [ ] **Step 2: Sarmalama** — şu serbest-metinleri `<TranslatedText text={...} sourceLang={...} />` ile göster:
  - `PatientInfoCard`: `notes`, `past_surgeries`, `medications` serbest-metin değerleri (request.source_lang). ("Yok" gibi sabit-UI zaten i18n — yalnız kullanıcı-girdisi metni sar.)
  - `RequestDetail`: doktor teklifleri `treatment_plan` (response.source_lang), onam/durum sabit metinleri DEĞİL.
  - `DoctorRequestView`: (varsa gösterilen not) — doktorun gördüğü hasta notları request.source_lang.
  - `AiPanel`: `suitability_note` + uyarı `rationale` (sourceLang="tr").
  - `DuplicateReview`: koordinatör/karar notları (varsa).
  - Hasta ad/soyad, sayılar, kategori (Faz 2) SARILMAZ.
- [ ] **Step 3: tsc + test + build** temiz. **Commit:** `feat(i18n): içerik alanlarına görüntüleyen-diline çeviri uygula`.

---

### Task 5: Doğrulama + deploy
- [ ] **Step 1:** tsc + `npx vitest run` + build temiz.
- [ ] **Step 2:** Controller e2e (tarayıcı + DB): AR arayüz kullanan satışçı bir talep+not oluşturur (source_lang='ar' yazılır); TR doktor açar → not/plan TR'ye çevrilmiş görünür + "otomatik çeviri" etiketi + "orijinali göster" AR'yi geri getirir. İkinci görüntüleme `content_translation` önbellek isabeti. Doktorun TR yanıtı → AR satışçıya AR.
- [ ] **Step 3:** `npm run deploy` + finishing-a-development-branch (main merge + push).

## Bağımlılık Sırası
Task 1 (şema+yazım) → Task 2 (edge function) → Task 3 (hook+bileşen) → Task 4 (uygula) → Task 5 (doğrula/deploy). Task 4, Task 1 (source_lang) + Task 3'e (TranslatedText) bağlı; Task 3, Task 2'ye (function) bağlı.
