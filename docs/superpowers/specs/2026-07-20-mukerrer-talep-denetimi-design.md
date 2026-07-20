# Mükerrer Talep Denetimi — Tasarım Spesifikasyonu

**Tarih:** 2026-07-20
**Durum:** Onaylandı (kullanıcı), plana geçiliyor
**Kapsam:** MedTriage — bir hastanın farklı kanal/zamanlardan birden fazla başvurusunu yakalama, doktora gitmeden koordinatör denetimine yönlendirme, AI destekli görsel doğrulama ve koordinatör geri bildirimiyle iyileşme.

---

## 1. Amaç ve Problem

Bir hasta farklı kanallardan (WhatsApp, telefon, form) ve farklı zamanlarda birden fazla başvuru yapabiliyor. Sistem bu mükerrerliği **isim, soyadı, telefon ve fotoğraf** üzerinden yakalamalı. Mükerrer şüphesi taşıyan talep:

- Sisteme kaydedilmeli (kaybolmamalı),
- Talebi giren satışçıya "Bu hastanın aktif bir talebi var" uyarısı verilmeli,
- **Doktora gitmemeli** — doğrudan koordinatöre, ayrı bir "Mükerrer Talep" bölümüne düşmeli,
- İçinde **ana (orijinal) talebin referansı** saklanmalı.

Koordinatör iki kaydı karşılaştırıp:
- Aynı hasta ise ikinci kaydı **mükerrer → pasif** almalı,
- AI/eşleşme hatalıysa (farklı kişi) ikinci kaydı **doktorlara salmalı**,
- Sisteme **ok / not-ok** geri bildirimi vererek AI'ın doğruluğunu beslemeli.

## 2. Kilit Kararlar (onaylandı)

| Karar | Seçim | Gerekçe |
|---|---|---|
| Görsel eşleştirme derinliği | **Doğrulama yardımı** (Claude vision, aday foto vs yeni foto) | Ucuz, sınırlı (≤5 aday), biyometrik vektör saklamaz. Yönlendirmeyi belirlemez, koordinatöre yardımcı olur. |
| Mükerrer kararını kim verir | **Otomatik, sunucu-taraflı** | Talep girildiğinde sistem açık-talep eşleşmesi bulursa otomatik koordinatöre yönlendirir; satışçı karar vermez. |
| "AI besleme" | **Bağlam örnekleri + eşik** | Koordinatör ok/not-ok etiketleri few-shot ipucu olarak vision prompt'una beslenir (FR-53 deseni). Model eğitimi YOK. |
| Tetik koşulu | **Açık talebi varsa** | Ana talep = en son `status<>'closed'` talep. Tüm talepler kapalıysa normal akış + bilgi rozeti. |

## 3. Global Kısıtlar

- **Yönlendirme deterministik**: mükerrer-şüphesi kararı (koordinatöre mi doktora mı) yalnız telefon/isim eşleşmesine dayanır — AI'a bağlı değildir. AI yalnız koordinatöre görsel öneri sunar; hata yapması yönlendirmeyi bozmaz.
- **Doktor görünürlüğü**: `pending` talepler için **assignment satırı hiç oluşturulmaz**; doktor kuyruğu assignment-tabanlı olduğundan doktorlar bu talepleri hiç görmez. Ek RLS gerekmez.
- **FR-21 sınırı korunur**: bu akış doktor değerlendirmesinden ÖNCE çalışır; doktor planları/AI değerlendirmeleri hiçbir zaman bu sürece girmez. Aracı (agent) mükerrer verisini göremez.
- **Onam kapısı**: görsel karşılaştırma (biyometrik işleme) yalnız `consent_at` dolu taleplerde çalışır (mevcut `ai-triage` onam kapısıyla aynı). Onam yoksa AI atlanır; koordinatör telefon/isim + fotoğrafları kendisi inceleyip karar verir.
- **Bloke etmez**: satışçı akışı hiçbir noktada durmaz; uyarı bilgilendiricidir (mevcut fire-and-forget deseni).
- **Sunucu-taraflı mutasyon**: tüm durum geçişleri whitelist'li `security definer` RPC ile yapılır (mevcut `assign_request_doctors` / audit deseni); istemciye doğrudan `request.dup_state` UPDATE verilmez.
- **Tenant izolasyonu**: tüm sorgular `current_tenant_id()` ile filtrelenir.

## 4. Mimari

Mevcut sisteme üç parça eklenir; hiçbiri mevcut `request_status` makinesini veya `recompute_request_status` trigger'ını değiştirmez.

```
Satışçı → wizard submit (useCreateRequest)
   │  request insert + foto upload  (mevcut)
   ▼
route_new_request(p_request_id)  [YENİ RPC, security definer]
   │
   ├─ açık-talep eşleşmesi? (telefon norm / isim trgm > 0.3)
   │      HAYIR → assign_request_doctors  → doktorlara (mevcut akış)
   │      EVET  → dup_state='pending'
   │              duplicate_of_request_id = <en son açık talep>
   │              (assignment YOK)
   │              return { routed:'coordinator', parentId }
   ▼
(istemci) satışçıya uyarı toast'u
   ▼
duplicate-vision edge fn  [YENİ, fire-and-forget, onam varsa]
   │  yeni foto + ana talep foto → Claude vision → {same,confidence,reason}
   │  + son N koordinatör feedback ipucu (FR-53)
   ▼  duplicate_check satırı yazılır
Koordinatör "Mükerrer Talep" bölümü
   ├─ resolve_duplicate(p_request_id,'confirmed', note)  → pasif + feedback
   └─ resolve_duplicate(p_request_id,'dismissed', note)  → assign_request_doctors + feedback
```

## 5. Veri Modeli (yeni migration `0028_duplicate_review.sql`)

### 5.1 Yeni enum'lar (kolon/tablolardan ÖNCE oluşturulur)
```sql
create type dup_state as enum ('none','pending','confirmed','dismissed');
create type dup_fb_label as enum ('ok','not_ok');
```
- `dup_state`:
  - `none` — normal talep (mükerrer değil).
  - `pending` — mükerrer-şüphesi; koordinatör kuyruğunda; doktora atanmadı.
  - `confirmed` — koordinatör mükerrer onayladı; talep pasif.
  - `dismissed` — koordinatör "mükerrer değil" dedi; doktorlara salındı, normal akışa girdi.

### 5.2 `request` kolon eklemeleri
```sql
alter table request
  add column duplicate_of_request_id uuid references request(id),
  add column dup_state dup_state not null default 'none';

create index request_dup_state_idx on request(tenant_id, dup_state) where dup_state <> 'none';
```

### 5.3 `duplicate_check` (AI görsel verdikti)
```sql
create table duplicate_check (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id),          -- yeni (şüpheli) talep
  parent_request_id uuid not null references request(id),   -- ana talep
  ai_same boolean,               -- AI kararı; null = onamsız/atlandı/hata
  ai_confidence numeric,         -- 0-1
  ai_reason text,
  status ai_status not null default 'ok',  -- ok|warning|failed (mevcut enum)
  model text, model_version text, error text,
  created_at timestamptz not null default now(),
  unique (request_id)
);
```

### 5.4 `duplicate_feedback` (koordinatör geri bildirimi = AI besleme sinyali)
```sql
create table duplicate_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id),
  duplicate_check_id uuid references duplicate_check(id),
  coordinator_label dup_fb_label not null,  -- 'ok' | 'not_ok'
  note text,
  decided_by uuid not null,                 -- auth.uid()
  decided_at timestamptz not null default now(),
  unique (request_id)
);
```
**Etiket anlamı = mükerrer-yakalamanın doğruluğu (koordinatör kararı), AI'ın kendisi değil.** Böylece hem kullanıcının "ok/not-ok" zihin modeline uyar hem de AI few-shot için doğrudan ground-truth verir:
- `ok` = koordinatör **mükerrer onayladı** (`confirmed`) → bu iki kayıt gerçekten AYNI kişi → vision için pozitif örnek.
- `not_ok` = koordinatör **reddetti** (`dismissed`) → bu iki kayıt FARKLI kişi → vision için negatif örnek (AI "aynı" demiş idiyse düzeltici, prompt'a öncelikli beslenir).

AI'ın çalışıp çalışmadığından bağımsızdır (onamsız/atlanmış talepte de koordinatör kararı ground-truth olarak kaydedilir); ama vision prompt'una yalnızca **fotoğrafı olan** feedback örnekleri beslenir.

### 5.5 Tenant ayarı
```sql
alter table tenant add column dup_confidence_threshold numeric not null default 0.75;
```
Vision "aynı kişi %" bu eşiğin altındaysa koordinatöre "düşük güven" olarak gösterilir (yönlendirmeyi etkilemez; yalnız görsel ipucu).

## 6. RLS

- `duplicate_check`, `duplicate_feedback` **okuma**: `current_role_name() in ('coordinator','admin')` + tenant. Aracı/satışçı/doktor göremez.
- `duplicate_check` **yazma**: yalnız service-role (edge fn). İstemci insert politikası yok.
- `duplicate_feedback` **yazma**: `resolve_duplicate` RPC içinden (security definer) yazılır; doğrudan istemci insert yok.
- `request.dup_state` / `duplicate_of_request_id` **UPDATE**: istemciye verilmez; yalnız `route_new_request` ve `resolve_duplicate` RPC'leri (security definer) yazar.
- Mevcut `req_admin_all` koordinatör/admin'e tüm talepleri gösterdiğinden `pending` talepler zaten koordinatöre görünür.

## 7. Sunucu RPC'leri (security definer)

### 7.1 `route_new_request(p_request_id uuid) returns jsonb`
- Yetki: caller `created_by = auth.uid()` **veya** rol `('coordinator','admin')` (mevcut `assign_request_doctors` deseni).
- Talebin hastasını (`patient_id`) alır; aynı tenant'ta **başka** hastanın açık talebini telefon/isim eşleşmesiyle arar (mevcut `find_patient_matches` mantığının açık-talebe indirgenmiş hâli):
  - Aday = `dup_state <> 'confirmed'` ve `status <> 'closed'` olan, `normalize_phone` eşit **veya** isim `similarity > 0.3` olan **farklı** talep. Kendi talebini hariç tutar.
- **Eşleşme varsa**: en son (`created_at desc`) açık talebi `parent` seçer; `dup_state='pending'`, `duplicate_of_request_id=parent`, atama YAPMAZ. Audit `'request_dup_pending'`. `jsonb_build_object('routed','coordinator','parentId',parent)` döner.
- **Eşleşme yoksa**: `assign_request_doctors(p_request_id)` çağırır. `jsonb_build_object('routed','doctors','assignedCount',n)` döner.
- Grant: authenticated; revoke public/anon.

### 7.2 `resolve_duplicate(p_request_id uuid, p_decision text, p_note text) returns jsonb`
- Yetki: rol `('coordinator','admin')`. Aksi `raise 'forbidden'`.
- Talep `dup_state='pending'` değilse `raise 'not pending'`.
- `p_decision='confirmed'`:
  - `dup_state='confirmed'`, `status='closed'` (pasif). Audit `'request_dup_confirmed'`.
  - `duplicate_feedback` yazılır: `label='ok'` (yakalama doğru; iki kayıt aynı kişi). `duplicate_check_id` varsa bağlanır.
- `p_decision='dismissed'`:
  - `dup_state='dismissed'`, `assign_request_doctors(p_request_id)` çağrılır (normal akış). Audit `'request_dup_dismissed'`.
  - `duplicate_feedback` yazılır: `label='not_ok'` (yakalama yanlış; farklı kişi).
- Grant: authenticated; revoke public/anon.

> Not: `label` doğrudan koordinatör kararından türer (`confirmed→ok`, `dismissed→not_ok`) — AI kararına bakılmaz. Bu, hem tutarlı hem de vision few-shot için net ground-truth sağlar (bkz. §5.4).

## 8. Edge Fonksiyonu `duplicate-vision`

- Tetik: `route_new_request` bir talebi `pending` yapınca istemci fire-and-forget invoke eder (mevcut `ai-triage` invoke deseni), **yalnız `consent_at` doluysa**.
- Adımlar (mevcut `ai-triage/index.ts` iskeletini izler):
  1. Caller auth (anon client) → service-role admin client.
  2. Onam kontrolü: `consent_at` null → `duplicate_check` `ai_same=null, status='ok', ai_reason='no_consent'` yazıp döner.
  3. Günlük tenant kotası (mevcut 300 desenini paylaşır veya ayrı sayaç).
  4. Yeni talebin ve `duplicate_of_request_id` talebinin aktif fotoğraflarının imzalı URL'lerini toplar (server-side signed, mevcut desen).
  5. Son N `duplicate_feedback` (fotoğrafı olanlar) → few-shot ground-truth: `ok`=aynı kişi örneği, `not_ok`=farklı kişi örneği (FR-53 deseni). Yalnız etiket + minimal bağlam beslenir (geçmiş fotoğraflar prompt'a tekrar konmaz; token/gizlilik).
  6. Claude vision (`claude-opus-4-8`, `thinking:{type:'adaptive'}`, JSON-schema structured output) → `{same:boolean, confidence:number, reason:string}`.
  7. `duplicate_check` upsert (unique `request_id`).
  - Hata → `status='failed'`, `ai_same=null`, 200 döner (bloke etmez).
- Sistem prompt'u: yalnız "bu iki fotoğraf grubu aynı kişiye mi ait" sorusuna odaklanır; teşhis/tedavi YOK; çıktı koordinatör-içindir. PII scrub gerekmez (yalnız foto + minimal bağlam).

## 9. İstemci (web)

### 9.1 `useCreateRequest` değişikliği (`src/features/requests/useRequests.ts`)
- Bugün: insert → foto upload → `assign_request_doctors`.
- Yeni: insert → foto upload → **`route_new_request`** (assign yerine). Dönen `routed` değerine göre:
  - `'coordinator'` → mutation sonucunda `{ duplicate:true, parentId }` döndürür; onam varsa `duplicate-vision` invoke eder (fire-and-forget).
  - `'doctors'` → mevcut `assignedCount` davranışı (uyarı vs).

### 9.2 Wizard uyarısı (`NewRequestWizard.tsx`)
- Submit sonucu `duplicate:true` ise: başarı ekranında/toast'ta "Bu hastanın aktif bir talebi var — kayıt koordinatör onayına gönderildi." (bloke etmez). Mevcut "Aynı hasta/Farklı kişi" öneri paneli submit-öncesi ipucu olarak **kalır** (satışçıya erken uyarı); ama nihai yönlendirme sunucudadır.

### 9.3 Koordinatör "Mükerrer Talep" bölümü
- `/admin/requests` içinde yeni **"Mükerrer Talep"** sekmesi (mevcut `SlaTab` deseni) veya ayrı rota `/admin/duplicates`. `dup_state='pending'` talepleri listeler.
- Yeni hook `useDuplicateQueue()` — pending talepler + hasta adı + ana talep özeti + `duplicate_check` verdikti.
- Kart bileşeni `DuplicateReviewCard`:
  - Yeni talep: hasta, telefon, kategori/operasyon, tarih.
  - Ana talep: hasta, tarih, kısa-id, durum.
  - Eşleşme sebebi rozeti (telefon/isim).
  - AI verdikti: "Aynı kişi: %NN" (eşik altı ise "düşük güven" tint) veya "onam yok / değerlendirilemedi".
  - Yan yana fotoğraflar (mevcut imzalı-URL deseni; koordinatör görebilir).
  - İki buton: **"Mükerrer — pasife al"** (`resolve_duplicate 'confirmed'`) · **"Mükerrer değil — doktorlara gönder"** (`resolve_duplicate 'dismissed'`), opsiyonel not alanı.
- Premium tasarım sistemi (Rafine Klinik) ile çizilir: Card, StatusPill/state-dot çip, token'lar, lucide ikon.

### 9.4 Ana talep referansı gösterimi
- İnsan-okur talep numarası bugün yok (UUID). Ana talep tarih + hasta + kısa-id (ilk 8 karakter) ile gösterilir. (İleride kısa sıralı kod eklenebilir — kapsam dışı.)

## 10. Mobil

- Doktor mobil uygulaması mükerrer akışından **etkilenmez** — `pending` talepler zaten atanmadığından doktor kuyruğuna hiç düşmez. Mobil tarafında değişiklik yok (koordinatör mobil app'i yok).

## 11. Test Stratejisi

- **SQL/RPC** (canlı doğrulama, mevcut desen): `route_new_request` — açık-talep eşleşmesinde `pending`+parent+atama yok; eşleşme yoksa atama yapılır. `resolve_duplicate` — confirmed→closed+feedback, dismissed→assign+feedback; yetkisiz rol 403.
- **Domain birim testleri**: mükerrer aday seçim mantığının TS ikizi (varsa) — telefon norm/isim eşik; parent seçimi (en son açık). `dup_state` geçiş kuralları.
- **Edge fn**: onamsız → `ai_same=null`; hata → `failed`+200.
- **E2E (Playwright)**: satışçı aynı telefon/isimle 2. talep girer → koordinatör kuyruğunda görünür, doktor kuyruğunda görünmez; koordinatör "doktorlara gönder" → doktor kuyruğunda görünür.
- **RLS**: aracı/doktor `duplicate_check`/`duplicate_feedback` okuyamaz.

## 12. Kapsam Dışı (bu tur)

- Yüz-embedding + pgvector ile farklı-telefon/isim yakalama (gelecek faz).
- Model fine-tuning.
- İnsan-okur sıralı talep numarası.
- Mobil koordinatör arayüzü.

## 13. İlgili Mevcut Kod (referans)

- `find_patient_matches` / `normalize_phone`: `supabase/migrations/0020_duplicate_detection.sql`
- Atama RPC: `supabase/migrations/0024_assignment_server_audit_guard.sql` (`assign_request_doctors`)
- AI + feedback deseni: `supabase/migrations/0010_ai_triage.sql`, `0011_ai_feedback_integrity.sql`, `supabase/functions/ai-triage/`
- RLS helper'lar: `supabase/migrations/0002_rls.sql` (`current_role_name`, `current_tenant_id`)
- Wizard/oluşturma: `src/features/requests/NewRequestWizard.tsx`, `src/features/requests/useRequests.ts`, `DuplicateMatchPanel.tsx`
- Koordinatör görünümü: `src/features/admin/AllRequests.tsx`
- Foto: `supabase/migrations/0004_storage_policies.sql`, `0016_photo_lifecycle.sql`, `src/features/requests/photoUrl.ts`
