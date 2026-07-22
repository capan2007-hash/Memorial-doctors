# Koordinatör Mobil Panel — Tasarım (fazlı)

**Tarih:** 2026-07-22
**Kapsam:** Mobil (`mobile/`, Expo/React Native). Web koordinatör ekranlarını mobile taşır.
**Erişim:** `coordinator` + `admin` + `super_admin` (web'deki gibi); rol farkları aksiyon düzeyinde.

## Mimari
- Yeni **`app/(admin)/`** rota grubu, kendi tab `_layout`'u ile. Doktor grubu (`(tabs)`) dokunulmadan kalır.
- **Rol-bazlı yönlendirme:** `login.tsx` oturum varsa role göre yönlendirir — `doctor → /(tabs)`, `coordinator|admin|super_admin → /(admin)`, diğer → login'de kalır/bloke. Her grup `_layout` kendi rolünü guard'lar (yanlış grup → doğru gruba redirect).
- Root Stack'e `(admin)` eklenir. `usePushSetup(doctorId,…)` koordinatörde doctorId=null → no-op (mevcut davranış).
- **Sunucu tarafı sıfır iş:** tüm RPC/edge-function'lar mevcut: `assign_request_doctors`, `resolve_duplicate`, `set_doctor_scopes`, `doctor_performance_summary`, `create-doctor`, `create-user`, `manage-user`.

**Koordinatör tab seti (5):** Talepler · Mükerrer · Doktorlar · Kullanıcılar · Ayarlar

## Paylaşılan RN katmanı (fazlar boyunca büyür)
- Atomlar (`mobile/src/components/ui/`): Button, Card, Field, EmptyState, Spinner, Toast — doktor ekranlarındaki inline desenlerden çıkarılır, ihtiyaç oldukça eklenir.
- Domain aynaları (web'den): `userRoles.ts` (creatableRoles/canManageTarget/roleLabel — Faz 4), `duplicate.ts` (dupConfidenceClass/formatConfidencePct — Faz 2). Her biri kendi fazında.
- Veri katmanı: web hook'ları RN'ye ayna (react-query + supabase, istemci-JOIN); ek REST gerekmez.

## Fazlar (her biri çalışan, test edilen, ayrı commit)

### Faz 0 — Foundation
- `app/(admin)/_layout.tsx` (5 tab, rol guard), `app/(admin)/ayarlar.tsx` (tema toggle + çıkış + kullanıcı bilgisi).
- 4 operasyonel tab için "Yakında" placeholder ekranları (sonraki fazlar doldurur).
- `login.tsx` rol-bazlı redirect; `(tabs)/_layout.tsx` koordinatörü bloke etmek yerine `(admin)`'e yönlendir; root Stack'e `(admin)`.
- Paylaşılan atomlardan Spinner + EmptyState.

### Faz 1 — Tüm Talepler (`talepler`)
Liste + filtre sekmeleri (Tümü/Bekleyen/Geciken/Tamamlanan, sayaçlı) + SLA rozetleri + "Yeniden ata" (`assign_request_doctors(p_request_id,'manual')`) + talep detay (okuma; koordinatör görünümü). Kaynak: request+patient+category+response+tenant(sla), `src/domain/sla.ts` ayna.

### Faz 2 — Mükerrer Talep (`mukerrer`)
`dup_state='pending'` kuyruğu + iki panel (yeni vs ana) + foto şeritleri (imzalı URL) + AI görsel verdict + not + onay/red (`resolve_duplicate(p_request_id,p_decision,p_note)`). Domain: `duplicate.ts` ayna.

### Faz 3 — Doktor Yönetimi (`doktorlar`)
Liste + performans (`doctor_performance_summary`) + yetkinlik/branş/bio düzenle (`set_doctor_scopes`) + yeni doktor (`create-doctor`) + foto; **Sil yalnız admin/super_admin** (`manage-user` delete_doctor). En karmaşık ekran — alt bileşenlere parçalanır (liste / kart / editör / yeni-doktor dialog).

### Faz 4 — Kullanıcı Yönetimi (`kullanicilar`)
Liste (`app_user`, doktor hariç) + yeni kullanıcı (`create-user`; koordinatör yalnız sales/agent) + şifre reset + aktif/pasif (`manage-user`). Domain: `userRoles.ts` ayna (rol yetki matrisi).

## Doğrulama (her faz)
- `npx tsc --noEmit` (mobil) = 0 hata; ilgili jest testleri geçer.
- iOS simülatöründe koordinatör test hesabıyla görsel doğrulama.
- Rol farkları: admin ile koordinatör aksiyon görünürlüğü ayrı doğrulanır.
