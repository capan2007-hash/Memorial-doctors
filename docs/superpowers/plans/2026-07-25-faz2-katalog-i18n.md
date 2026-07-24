# Faz 2 — Katalog i18n (kategori / alt kırılım / operasyon adları) Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Adımlar checkbox (`- [ ]`).

**Goal:** Katalog adlarını (kategori, alt kırılım, operasyon) TR+AR+EN'de göstermek — dropdown'larda ve liste/detay ekranlarında — okuyucunun arayüz diline göre, `name` fallback ile.

**Architecture:** Katalog tablolarına `name_i18n jsonb` sütunu; migration'da TR+AR+EN seed. Görüntülemede `catalogName(row, lang)` yardımcısı `name_i18n->>lang ?? name` döndürür. Dropdown'lar satır objesinden okur; liste/detay DB sorguları `name_i18n`'i de çeker.

**Tech Stack:** Supabase (jsonb migration), React + react-i18next.

## Global Constraints
- İşlevsellik/veri akışı/RLS BOZULMAZ; yalnız görünen ad lokalize edilir.
- `name` (TR) sütunu **kaynak/kanonik** kalır; `name_i18n` yoksa ona düşülür.
- Katalog **düzenleme** (varsa) kapsam dışı; yalnız görüntüleme.
- Çeviriler: kategori/alt kırılım/operasyon için aşağıdaki tabloda (birebir kullan).

---

### Task 1: Migration — `name_i18n jsonb` + TR/AR/EN seed

**Files:** Create `supabase/migrations/0042_catalog_i18n.sql`

- [ ] **Step 1: Migration yaz** — üç tabloya `name_i18n jsonb` ekle (nullable), sonra her satırı `name`'e göre eşleyip seed et. Çeviriler:

| TR (kaynak) | EN | AR |
|---|---|---|
| Boy Uzatma | Limb Lengthening | إطالة القامة |
| Diş Tedavisi | Dental Treatment | علاج الأسنان |
| Genital Estetik | Genital Aesthetics | تجميل الأعضاء التناسلية |
| Obezite Cerrahisi | Bariatric Surgery | جراحة السمنة |
| Penis Estetiği | Penis Aesthetics | تجميل القضيب |
| Plastik Cerrahi | Plastic Surgery | الجراحة التجميلية |
| Saç Ekimi | Hair Transplant | زراعة الشعر |
| Burun estetiği | Rhinoplasty | تجميل الأنف |
| ESG & POSE | ESG & POSE | ESG & POSE |
| Gastric Sleeve | Gastric Sleeve | تكميم المعدة |
| Meme estetiği | Breast Aesthetics | تجميل الثدي |
| Revizyon Cerrahisi | Revision Surgery | جراحة المراجعة |
| Vücut estetiği | Body Aesthetics | تجميل الجسم |
| Yüz estetiği | Facial Aesthetics | تجميل الوجه |
| 360 Lipo | 360 Lipo | شفط دهون 360 |
| FUE Saç Ekimi | FUE Hair Transplant | زراعة شعر FUE |
| Karın Germe | Tummy Tuck | شد البطن |
| Rinoplasti | Rhinoplasty | تجميل الأنف |
| Tüp Mide | Gastric Sleeve | تكميم المعدة |

SQL deseni (her satır için `update ... set name_i18n = jsonb_build_object('tr', name, 'en', '<EN>', 'ar', '<AR>') where name = '<TR>'`). `jsonb`'de `tr` = mevcut `name`.

- [ ] **Step 2: Controller migration'ı uygular** (Supabase MCP `apply_migration`, isim `catalog_i18n`). Beklenen: 3 sütun + 19 satır seed'li.
- [ ] **Step 3:** `src/types/db.ts`'te `CategoryRow`/`SubcategoryRow`/`OperationTypeRow` tiplerine `name_i18n: Record<string,string> | null` ekle.
- [ ] **Step 4: tsc + build** temiz. **Commit:** `feat(i18n): katalog name_i18n sütunu + TR/AR/EN seed`.

---

### Task 2: `catalogName` yardımcısı + dropdown'larda uygula

**Files:** Create `src/features/catalog/catalogName.ts`; Modify `NewRequestWizard.tsx`, `DoctorProfile.tsx`, `DoctorAdmin.tsx` (ScopeChip/ScopeEditor/CategoryScopeRow ve WeightedWork DEĞİL — yalnız katalog adı gösterilen yerler).

**Interfaces:** Produces `catalogName(row: {name: string; name_i18n?: Record<string,string>|null}, lang: string): string`.

- [ ] **Step 1: Başarısız test yaz** — `catalogName.test.ts`: `name_i18n` varsa `lang` değerini, yoksa/`lang` eksikse `name`'i döndürür.
- [ ] **Step 2: Yardımcıyı yaz** — `return row.name_i18n?.[lang] ?? row.name`.
- [ ] **Step 3: Test PASS.**
- [ ] **Step 4: Dropdown/çip gösterimlerinde uygula** — `useCategories/useSubcategories/useOperationTypes` satırlarının `.name`'ini gösteren her yerde `catalogName(row, i18n.language)` kullan (`const { i18n } = useTranslation()`). Hedefler: NewRequestWizard kategori/alt-kırılım/operasyon SelectItem'ları; DoctorProfile ScopeChip label'ları (kategori + alt kırılım); DoctorAdmin ScopeEditor/CategoryScopeRow + ScopeChips (kategori/alt kırılım adları).
- [ ] **Step 5: tsc + test + build** temiz. **Commit:** `feat(i18n): katalog adı yardımcısı + dropdown lokalize`.

---

### Task 3: Liste/detay sorgularında `name_i18n` çek + gösterimde çöz

**Files:** Modify `DoctorQueue.tsx`, `DoctorRequestView.tsx`, `AllRequests.tsx`, `useDuplicateQueue.ts`, `useRequests.ts` (RequestDetail veri kaynağı), `RequestList.tsx` (categoryName), ve gerekiyorsa `PatientInfoCard` (prop olarak lokalize ad alır).

- [ ] **Step 1: DB select'lerine `name_i18n` ekle** — `select('id, name')` → `select('id, name, name_i18n')`; `select('name')` → `select('name, name_i18n')`. İlgili map'lerde ham satırı sakla.
- [ ] **Step 2: Gösterimde `catalogName(row, i18n.language)` uygula** — `categoryName`/`subcategoryName`/`operationName` string'lerini artık lokalize üret. Bu değerler prop olarak PatientInfoCard/başlık birleşimine gidiyor; lokalize string geçir (bileşen imzası değişmez, yalnız değer lokalize). Not: React Query cache anahtarına dil eklenmesi gerekMEZ — `catalogName` render-anında `i18n.language` ile çözüldüğü için dil değişince yeniden render yeterli (ham `name_i18n` cache'de).
- [ ] **Step 3:** DoctorAdmin'deki `subcategory` toplu select'i (`select('*')`) zaten `name_i18n` içerir; ScopeChips lokalize (Task 2 kapsamında değilse burada).
- [ ] **Step 4: tsc + test + build** temiz; parite testleri etkilenmez (bu iş DB verisi, i18n bundle değil). **Commit:** `feat(i18n): liste/detay ekranlarında katalog adı lokalize`.

---

### Task 4: Doğrulama + deploy
- [ ] **Step 1:** tsc temiz · `npx vitest run` yeşil · build başarılı.
- [ ] **Step 2:** Controller tarayıcı: AR'de Yeni Talep dropdown'ları + Talep listesi/detayı katalog adları Arapça; TR'de birebir; EN'de İngilizce.
- [ ] **Step 3:** `npm run deploy` + finishing-a-development-branch (main merge).

## Bağımlılık Sırası
Task 1 (migration+tip) → Task 2 (yardımcı+dropdown) → Task 3 (liste/detay) → Task 4 (doğrulama/deploy). 2 ve 3 name_i18n tipine bağlı.
