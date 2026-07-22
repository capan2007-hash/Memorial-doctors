# Aktivite Akışı (Timeline) — Tasarım

**Tarih:** 2026-07-22
**Kapsam:** Web (`src/`). Mobil dışında.

## Amaç
Ekip geri bildirimi: doktorlara yönlendirilen talepler "işin aktığını" gösterip satışı motive ediyor. Satışçı/admin/super_admin panellerine, yukarıdan aşağıya akan bir **aktivite akışı (timeline)** ekle: satışçı/acentaların girdiği ve doktorlara yönlendirilen her talep bir satır.

Örnek satır:
> **Satışçı Berke** · 22.07.2026 · 23:15 — bir **plastik cerrahi** vakası girişi yaptı → **6 doktora yönlendirildi**

## Ekran
Yeni **"Akış"** ekranı (`/akis`). Görenler: `sales`, `admin`, `super_admin` (agent/coordinator hariç).
- Dikey timeline; her düğüm: rol ikonu, isim + rol ibaresi (Satışçı / **Acenta**), tarih·saat, vaka türü, doktor sayısı rozeti.
- `agent` rolü akışta **"Acenta"** olarak yazılır (Bookimed vb.), `sales` → "Satışçı".
- react-query `useInfiniteQuery`: en yeni N kayıt + "Daha fazla" ile geçmişe sayfalama; ~60sn sessiz yenileme (canlı his).
- Rafine Klinik tokenları; açık/koyu tema.

## Veri — `activity_timeline(p_limit int, p_before timestamptz)` RPC
SECURITY DEFINER, `search_path=public`. Rol guard: caller `sales|admin|super_admin` değilse boş döner. **Tenant = caller'ın kliniği** (üçü de yalnız kendi kliniği; super_admin de tek klinik).

Döner (satır başına): `request_id, created_at, creator_name, creator_role, category_name, subcategory_name, doctor_count`.
- **Filtre:** `exists(assignment for request)` — yalnız ≥1 doktora atanan talepler. Mükerrer/koordinatöre düşen bekleyenler görünmez.
- Sıra: `created_at DESC`; keyset sayfalama (`p_before` verilirse `created_at < p_before`).
- `p_limit` 1..100 arası kelepçelenir (varsayılan 30).
- **Hasta PII dönmez** — yalnız vaka türü + doktor sayısı.
- `grant execute ... to authenticated`.

## Dosyalar
- `supabase/migrations/0038_activity_timeline.sql` — RPC + grant.
- `src/domain/activity.ts` (+ `__tests__/activity.test.ts`) — `activityRoleLabel`, `caseTypeLabel`, `doctorCountText`, `formatActivityDateTime`.
- `src/features/activity/useActivity.ts` — `useActivityTimeline` (useInfiniteQuery, keyset).
- `src/features/activity/ActivityTimeline.tsx` — timeline UI.
- `src/lib/nav.ts` — Akış linki (sales + admin/super_admin; coordinator/agent hariç).
- `src/App.tsx` — `/akis` route, RoleGate allow=`sales|admin|super_admin`.

## Doğrulama
- `npx tsc --noEmit -p tsconfig.app.json` = 0 hata; vitest activity testleri geçer.
- RPC canlı SQL ile doğrulanır (satır + doktor sayısı).
- Playwright ile satışçı ve admin olarak /akis görsel doğrulanır (açık/koyu tema).
