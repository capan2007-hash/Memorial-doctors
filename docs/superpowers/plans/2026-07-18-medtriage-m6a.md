# M6a Doktor Mobil Uygulaması Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Doktorların telefondan talep görüp karar verdiği, push bildirimli Expo uygulaması (spec: `2026-07-18-medtriage-m6a-doktor-app-design.md`).

**Architecture:** `mobile/` bağımsız Expo app (Expo Router + TanStack Query + supabase-js/AsyncStorage); backend değişikliği yalnız `push_token` migration + `notify-assignment` Edge Function + assignment webhook.

**Tech Stack:** Expo SDK (güncel), TypeScript, expo-router, @tanstack/react-query, @supabase/supabase-js, @react-native-async-storage/async-storage, expo-notifications, expo-image, @expo-google-fonts/fraunces + plus-jakarta-sans, jest-expo.

## Global Constraints
- Backend sözleşmeleri DEĞİŞMEZ (tablolar/RLS/edge fn'ler aynı; yalnız push_token + notify-assignment eklenir).
- UI Türkçe; kod İngilizce; Klinik Güven renkleri (brand #0F766E/#115E59/#CCFBF1/#F0FDFA, accent #D97706/#B45309/#FEF3C7, surface #F8FAFC).
- FR-21/agent kısıtları sunucuda — app'te doktor-dışı rol yalnız kibarca reddedilir.
- Commit Türkçe conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Web tarafı bozulmaz: kök `npm run build` + 121 test + E2E yeşil kalır.

## Task 1: Scaffold + tema + Supabase istemcisi (controller)
- [ ] `npx create-expo-app@latest mobile --template` (TS, expo-router'lı default şablon); gereksiz örnek ekranlar temizlenir.
- [ ] Bağımlılıklar: `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage @tanstack/react-query expo-notifications expo-image expo-constants` + google fonts paketleri.
- [ ] `mobile/src/lib/supabase.ts` (URL+anon key `app.config.ts` extra üzerinden; AsyncStorage auth storage), `mobile/src/theme.ts` (renk tokenları), `.env` kökten kopyalanmaz — anon key public olduğundan app.config'e gömülür.
- [ ] `mobile/src/domain/` kopyaları: format.ts (timeAgo), status.ts (STATUS_LABELS), health.ts (bmi, medicalValue) + jest-expo testleri.
- [ ] Commit `feat(mobile): Expo iskeleti + tema + supabase istemcisi`.

## Task 2: Auth + giriş ekranı + rol kapısı
- [ ] AuthProvider (session + app_user fetch + doctor row fetch → doctorId); login ekranı (web LoginPage eşleniği); doctor-dışı rol → "Bu uygulama doktorlar içindir" + çıkış düğmesi; oturum kalıcılığı.
- [ ] Router: `(auth)/login` ↔ `(app)/(tabs)/…` korumalı grup.
- [ ] Commit `feat(mobile): giriş + doktor rol kapısı`.

## Task 3: Bekleyen kuyruk + geçmiş sekmeleri (realtime)
- [ ] `useDoctorQueue` (web useMyDoctorRequests eşleniği: assignment+request+patient+category join'leri, yanıtsızlar), realtime kanal (unique isim + crypto.randomUUID desenine dikkat), `useHistory` (yanıtlananlar).
- [ ] Kuyruk satırı: hasta adı, operasyon, timeAgo, foto sayısı; boş durum. Geçmişte karar rozeti.
- [ ] Commit `feat(mobile): bekleyen kuyruk + geçmiş (realtime)`.

## Task 4: Talep detayı — hasta kartı + foto galerisi + kabul/red
- [ ] `useRequestDetail(id)` (web eşleniği: request+patient+category/sub/op adları+photos imzalı URL'ler); PatientInfoCard native; foto şeridi + tam ekran zoom modal (expo-image); alt sabit aksiyon barı: Kabul→plan input→gönder, Red→gerekçe→gönder (web useRespond eşleniği: yalnız response insert, status'u trigger hesaplar); yanıtlanmışsa salt-okunur karar bloğu.
- [ ] Commit `feat(mobile): talep detayı + kabul/red akışı`.

## Task 5: AI Triyaj Paneli (mobil)
- [ ] `useAiEvaluation`/`useAiFeedbackFor`/`useSubmitAiFeedback` mobil kopyaları; AiPanel native: durumlar (hazırlanıyor ≤120sn spinner — web'deki setTimeout pes etme deseni dahil, failed satırı, ok/warning kart), Türkçe uyarı etiket haritası + %güven rozeti, "Uygunluk değerlendirmesi", disclaimer bandı, Doğru/Kısmen doğru/Yanlış + not + gönder; verilmişse rozet.
- [ ] Commit `feat(mobile): AI triyaj paneli + geri bildirim`.

## Task 6: Push — migration + notify-assignment + app entegrasyonu (controller: migration/deploy)
- [ ] Migration 0013 `push_token` (spec §3) + RLS; uygula.
- [ ] Edge Function `notify-assignment` (verify_jwt=false + `x-webhook-secret` başlık kontrolü; secret: `NOTIFY_WEBHOOK_SECRET`): assignment kaydı → doktorun tokenları → Expo Push API; hata yutulur. Deploy + Supabase Database Webhook (assignment INSERT → fonksiyon URL, secret başlıkla).
- [ ] App: Ayarlar sekmesi + izin akışı + token upsert (girişte ve izinde), çıkışta token sil; bildirim tıklama → `/request/[id]` deep link.
- [ ] Commit `feat(mobile): push bildirimleri (push_token + notify-assignment)`.

## Task 7: Canlı doğrulama + review + merge (controller)
- [ ] iOS simülatörde tam tur (giriş→kuyruk→detay→AI→kabul) + `simctl` ekran görüntüleri; jest testleri; kök web build+121 test+E2E yeşil; Android dev build (EAS) push canlı testi — Expo hesabı gerekirse kullanıcıdan istenir.
- [ ] Final review (tüm branch) + düzeltmeler + merge.
