# MedTriage Kapsamlı Denetim Raporu — 23.07.2026

**Yöntem:** 4 paralel denetim ajanı (backend/güvenlik · web · mobil · test-CI) + canlı Supabase güvenlik/performans advisor taraması + kritik bulguların elle doğrulaması. Tüm bulgular gerçek kod okunarak üretildi; en ciddi olanlar ayrıca canlı DB'de doğrulandı.

## ✅ Uygulanan düzeltmeler (23.07.2026 — Step 1)
- **K2** `find_patient_matches` rol guard'ı (0039) — doktor artık hasta PII tarayamıyor. *Doğrulandı: doctor JWT→0, sales JWT→1 satır.*
- **K1** storage `photos` SELECT kapsamlı erişim (0040) — `can_read_photo_object()` ile rol+talep kapsamı; arşiv daima edge-fn'e. *Doğrulandı: 9/9 fonksiyon-düzeyi senaryo.*
- **K3-kısmi** `photo-url` (super_admin yetki bug'ı + top-level try/catch) ve `notify-sla` (hata loglama) — deploy edildi.
- **0037/0038** `activity_timeline`/`own_doctor_ranks` public/anon revoke (0039). *Doğrulandı: proacl'de anon yok.*
- **Kalan Step 1:** Leaked-password koruması → Supabase panelinden tek tık (Auth → Password → HaveIBeenPwned).

---

**Genel karar:** Kod tabanı disiplinli (RLS/RPC katmanı olgun, domain testleri örnek düzeyde, cross-tenant sızıntı YOK, rol yükseltme engelleri sunucu tarafında doğru). Ancak üç sistemik zayıflık var: (1) tenant-İÇİ aşırı erişim (storage + bir RPC hasta PII'sini role bakmadan açıyor), (2) hata yolları görünmez (Sentry yok, hatalar "boş liste" olarak maskeleniyor), (3) iş mantığının ağırlık merkezi (SQL/RPC + edge fn) tamamen testsiz ve e2e CI dışında.

---

## KRİTİK (hemen kapatılmalı)

### K1. Storage `photos` SELECT politikası tüm tenant kullanıcılarına açık ✅doğrulandı
`supabase/migrations/0004_storage_policies.sql:9-14`
Politika yalnız `foldername[1] = current_tenant_id()` koşullu. `photo` tablosu RLS'i ve `photo-url` edge fn'i "agent/sales arşive erişemez, doktor yalnız atandığı talep" kuralını titizlikle kurarken, herhangi bir tenant kullanıcısı `storage.list('<tenant_id>/')` ile TÜM hastaların aktif+arşiv fotoğraf/röntgenlerini kendi JWT'siyle doğrudan indirebilir; audit de yazılmaz. KVKK açısından en ciddi bulgu.
**Fix:** SELECT/INSERT politikalarına rol+talep kapsaması ekle; ham erişimi koordinatör/admin ile sınırla, diğer roller yalnız `photo-url` üzerinden.

### K2. `find_patient_matches` rol guard'sız — hasta PII taraması mümkün ✅doğrulandı
`supabase/migrations/0020_duplicate_detection.sql` — SECURITY DEFINER, yalnız tenant filtresi, `authenticated`'a grant'li; `first_name/last_name/phone` + başvuru geçmişi döner. Trigram eşiği 0.3 olduğundan doktor dahil her rol isim parçalarıyla tenant'taki hastaların telefonlarını toplayabilir (patient RLS baypası).
**Fix:** Gövdeye `current_role_name() in ('agent','sales','coordinator','admin')` guard'ı.

### K3. Hata izleme yok + hatalar sistematik yutuluyor
- Sentry/ErrorBoundary hiçbir katmanda yok (bilinen P0-2, hâlâ açık). Edge fn'lerde 0 `console.*`; `notify-sla` push hatasını `{ok:false}`+HTTP 200 ile yutuyor — SLA bildirimi sessizce kaybolur.
- Web+mobilde yaygın desen: `const { data } = await supabase...` (error okunmuyor) + ekranlarda `isError` dalı yok → ağ/RLS hatası **"Henüz talep yok" / "Bekleyen mükerrer talep yok"** olarak görünür. Örnekler: `mobile/src/features/admin/useAllRequests.ts:46`, `src/features/doctor/DoctorQueue.tsx:32`, `src/features/admin/DuplicateReview.tsx:206`, `src/features/admin/UserAdmin.tsx:153`, `src/lib/auth.tsx:48` (app_user hatası → sessiz rolsüz kullanıcı).
**Fix:** Sentry (web+RN+Deno) + root ErrorBoundary; tüm sorgularda `if (error) throw`; tüm listelerde isError + "Tekrar dene".

### K4. Talep oluşturma atomik değil → mükerrer hasta/talep
`src/features/requests/useRequests.ts:36-93` + `NewRequestWizard.tsx:176-183`
Hasta+talep insert'inden sonra foto yükleme veya `route_new_request` hata verirse kullanıcı tekrar "Gönder"e basar → ikinci hasta+talep oluşur; ilk kayıt yönlendirilmemiş kalır. Ayrıca "koordinatöre düştü/0 doktor" uyarı dallarında form kilitlenmiyor → çift gönderim mümkün.
**Fix:** Akışı tek RPC/transaction'a taşı veya retry'da mevcut requestId'yi yeniden kullan; uyarı dallarında formu kilitle.

### K5. E2E CI'da yok · deploy/migration CI kapısız
`.github/workflows/ci.yml`: yalnız tsc+vitest+build (+mobil tsc/jest). Playwright lokalde elle; `npm run deploy` lokalden CI yeşil olmadan yapılabiliyor; migration'lar elle uygulanıyor (drift riski). Lint script'i (`oxlint`) CI'da hiç çalışmıyor.
**Fix:** E2E'yi nightly/PR-label workflow'a al; main-yeşil koşullu deploy + `supabase db diff` adımı; CI'ya lint.

---

## YÜKSEK

**Y1. Mobil stack ekranlarına agent/sales sızabilir** — `mobile/src/app/talep/[id].tsx`, `doktor/[id].tsx`, `doktor/yeni.tsx`: guard yalnız `role==='doctor'` redirect'i; agent/sales (ve role=null iken) ekranlar render olur. Fix: (admin)/_layout'taki pozitif allowlist + loading kontrolü. *(kullanici/yeni.tsx'te de loading beklenmeden redirect var.)*

**Y2. Android'de şifre sıfırlama çalışmıyor** — `mobile/src/app/(admin)/kullanicilar.tsx:84`: `Alert.prompt` iOS-only (Android'de no-op). Fix: platform-bağımsız Modal+TextInput.

**Y3. Refetch formu sıfırlıyor (aynı bug 2 yerde)** — `mobile/src/app/doktor/[id].tsx` ve `src/features/admin/DoctorAdmin.tsx:458`: `useEffect([doctor])` her invalidation'da kullanıcı girdisini sunucu değeriyle ezer (yüklenmiş ama kaydedilmemiş foto path'i dahil). Fix: bağımlılığı `doctor?.id` yap.

**Y4. Mobil signOut cache temizlemiyor** — `mobile/src/lib/auth.tsx:95`: çıkış sonrası aynı cihazda başka hesap girerse önceki tenant'ın hasta/talep verileri cache'ten görünür. Fix: `queryClient.clear()` + anahtarlara tenantId.

**Y5. `.single()` null kazaları** — `useRequests.ts:123`, `DoctorRequestView.tsx:36`: RLS/ağ hatasında TypeError; gerçek hata "Talep bulunamadı" maskesine düşer.

**Y6. Edge fn + SQL/RPC katmanı testsiz** — 10 edge fn handler'ının ve 27 SQL fonksiyonunun sıfır testi (yalnız ai-triage'ın saf modülleri vitest'te). E2E 3 senaryo: doktor RED kararı, mükerrer ONAY (confirmed dalı!), billing, akış, SLA eskalasyonu kapsanmıyor.

**Y7. Rate limiting yalnız ai-triage'da** — create-user/create-doctor/manage-user/billing-admin/photo-url'de throttle yok; auth'lu hesap sınırsız çağrı üretebilir.

---

## ORTA

- **Hasta tablosu filtresiz çekiliyor (PII aşırı-getirme, web+mobil):** `useRequests.ts:106`, `AllRequests.tsx:54`, `useDuplicateQueue` (her ikisi), `DoctorQueue.tsx:39`, `mobile useAllRequests.ts:48` — tüm tenant hastaları tarayıcı/telefon belleğine iniyor. `.in(id,...)` filtresi ekle. (Mobil mükerrer kuyruğunda ayrıca N+1 seri imzalama.)
- **İmzalı foto URL'leri (300sn) query cache'te süresiz:** web `photoUrl.ts`/`useDoctors.ts:211` + mobil aynısı — 5dk sonra görseller kırılır (mükerrer karşılaştırmada kritik). `staleTime`/`refetchInterval` imza ömrüne bağlanmalı.
- **Invalidation eksikleri:** `useSetSaleStatus` yalnız `['request',id]`; `requests`/`all-requests` bayat kalır. `useResolveDuplicate` (web) `all-requests`'i atlıyor.
- **super_admin RequestDetail'de içerik göremiyor:** `RequestDetail.tsx:156` allow listeleri super_admin'i dışlıyor (teklifler/AI/satış kartı boş).
- **RoleGate yetkisizde `null` → boş sayfa;** `/requests/:id` route'u RoleGate'siz (yalnız RLS'e güven — kapsam doğrulanmalı).
- **photo-url/ai-triage/duplicate-vision'da top-level try/catch eksik** → CORS'suz 500 (bilinen ders bu üçüne uygulanmamış).
- **0037/0038 RPC'lerinde PUBLIC/anon revoke atlanmış** ✅canlı doğrulandı (`activity_timeline`, `own_doctor_ranks` — auth.uid() guard'lı olduğundan fiili sızıntı yok; savunma katmanı eksik). Diğer tüm RPC'lerde revoke var.
- **`guard_request_patient_tenant` yalnız INSERT'te** — UPDATE'te patient_id değişimi denetlenmiyor.
- **Mobil admin ekranlarında pull-to-refresh/refetch stratejisi yok** (doktor tarafında var); koordinatör yeni talebi ancak uygulama yeniden başlatınca görür. Koordinatör push bildirimi tamamen yok (şema doctor_id-merkezli).
- **`is_active` client'ta kontrol edilmiyor** — pasifleştirilen kullanıcı oturumu sürdükçe gezinir (RLS'e emanet).
- **Mükerrer/yeniden-ata butonlarında çift tıklama koruması eksik** (`AllRequests.tsx:185`); doktor yanıt verdikten sonra Kabul/Red hâlâ aktif (`DoctorRequestView.tsx:137`).
- **mukerrer.tsx'te KeyboardAvoidingView yok** (not alanını klavye kapatır).
- **Canlı advisor (performans):** 45× çoklu-permissive-policy (WARN), 36× indekssiz FK, 6× RLS initplan (`auth.uid()` satır başına yeniden hesaplanıyor — `(select auth.uid())` sarmalı önerilir), 2 kullanılmayan indeks.
- **Auth ayarı:** Leaked password protection kapalı (HaveIBeenPwned kontrolü) — panelden tek tık.
- **tsconfig.app.json yalnız src/** — e2e spec'leri ve edge fn'ler tip denetimsiz.
- **Modal erişilebilirliği:** role="dialog"/focus-trap/Escape yok (3 kopya modal — ortak bileşen çıkarılmalı).
- **auth_rls hataları:** `normalize_phone` mutable search_path; pg_net/pg_trgm public şemada (advisor WARN).

## DÜŞÜK (özet)

Koyu temada override'sız brand-50/100/200 tonları; `scoreTier`'ın ham Tailwind döndürmesi (3 kopya çeviri sözlüğü); score domain'inde adet-sayma vs delta-toplama tutarsızlığı; SLA "0s kaldı" etiketi; akış keyset sayfalamasında eşit created_at kayıt atlaması + kısmi sayaçlar; tenant sorgusu filtresiz `.single()`; `as any` tip kaçakları + 4 kopya enrich deseni; mobil deprecated `MediaTypeOptions` uyarısı; yetim foto dosyaları (kaydedilmeyen yüklemeler bucket'ta kalıyor); şifre alanları secureTextEntry'siz/doğrulamasız; followup dosyalarındaki borçların issue takibi yok; `app_secret`/`model_price`/`platform_config` RLS'li-politikasız (bilinçli service-role-only — dokümante edilmeli); web `scoreTier`+`formatActivityDateTime` testsiz.

## Güçlü yönler

Cross-tenant sızıntı yok; SECURITY DEFINER'larda search_path tutarlı; rol yükseltme engelleri (CREATABLE haritası) sunucu tarafında; EXIF temizleme/imzalı URL/taslak temizliği gibi bilinçli gizlilik desenleri; domain katmanı testleri (web ~%90, mobil ~%100) CI'da; aşamalı sertleştirme geçmişi (0009/0019/0024/0026) düzenli.

## Önerilen sıra

1. **Bu hafta:** K1 (storage politikası) + K2 (find_patient_matches guard) — iki küçük migration. K3'ün hızlı yarısı: edge fn'lere console.error + top-level try/catch; leaked-password koruması aç; 0037/0038 revoke.
2. **Sprint:** K4 (atomik talep oluşturma) + Y1-Y5 (mobil guard'lar, Android prompt, form-refetch, signOut cache, .single()) + tüm listelere isError.
3. **Sonraki sprint:** Sentry entegrasyonu; e2e'yi CI'ya bağlama + RED/confirmed senaryoları; RPC'lere pgTAP; rate limiting; PII aşırı-getirme daraltma.
4. **Rutin:** performans advisor temizliği (policy birleştirme, FK indeksleri), erişilebilir Modal, kod tekrarı temizliği.
