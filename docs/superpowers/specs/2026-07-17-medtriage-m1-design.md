# MedTriage — M1: Çekirdek Talep Döngüsü (Tasarım Spec'i)

**Tarih:** 2026-07-17
**Sürüm:** 1.0
**Kaynak:** MedTriage BRD v2.0 (Rememore pilot tenant)
**Kapsam:** M1 — platformun ilk dikey dilimi (çekirdek talep döngüsü)

---

## 1. Amaç ve Çerçeve

MedTriage, Rememore'un WhatsApp üzerinden dağınık ilerleyen estetik cerrahi taleplerini tek bir mobil-öncelikli, çok kiracılı (multi-tenant) triyaj platformunda toplar. Bu spec, platformun **ilk inşa edilecek dilimi olan M1'i** tanımlar: talebin girilmesinden doktor yanıtına kadar olan çekirdek döngü.

M1, ürünü uçtan uca çalışır halde gösteren en küçük tutarlı dilimdir. AI triyaj, skor/SLA, KVKK fotoğraf yaşam döngüsü, mükerrer tespiti ve native push sonraki milestone'lara bırakılmıştır; ancak M1 veri modeli bunlara genişleyecek şekilde tasarlanır.

### Platform decomposition (bağlam)

| # | Alt-proje | Durum |
|---|-----------|-------|
| **M1** | **Çekirdek talep döngüsü** | **Bu spec** |
| M2 | AI triyaj + geri besleme döngüsü | Sonraki |
| M3 | Skor + SLA + eskalasyon | Sonraki |
| M4 | KVKK fotoğraf yaşam döngüsü | Sonraki |
| M5 | Mükerrer tespiti + hasta kimliği | Sonraki |
| M6 | Native mobil + push (RN/Expo) | Sonraki |

Her milestone kendi spec → plan → implementation döngüsünü alır.

---

## 2. BRD'den Bilinçli Sapma — Atama/Sahiplenme Modeli

**BRD FR-14 / FR-19b**, "ilk kabul eden doktor talebi sahiplenir; diğerlerinde talep 'başkası tarafından alındı' olur" der. **Bu spec bunu bilinçli olarak geçersiz kılar** (kullanıcı kararı):

- Talep, kategori/alt kırılıma tanımlı **tüm doktorlara** eşzamanlı gider.
- **Her doktor bağımsızca kabul/red verebilir.** Sahiplenme, yarış koşulu, "başkası aldı" durumu **yoktur**.
- Kabul eden her doktor kendi tedavi planını yazar; **tüm planlar toplanır**.
- Satışçı planları hastaya sunar; **hasta doktoru seçer** (hasta uygulamada olmadığı için seçim uygulama dışında gerçekleşir).
- Doktorların farklı zamanlarda kabul edip yorum yazması normaldir; sorun değildir.

**Korunan kurallar:** red'de gerekçe zorunludur (FR-19); **tüm doktorlar red verirse** koordinatöre eskalasyon üretilir (FR-19c); red kendi tedavi başlığında kalır, çapraz yönlendirme yok (FR-19e).

Bu sapma, "ilk-kabul yarışı" için atomik update ihtiyacını ortadan kaldırır ve modeli basitleştirir.

---

## 3. Kapsam

### 3.1 Kapsam içi (M1)

- **Rol bazlı auth** (davet-bazlı, self-signup yok): giriş + aracı / satışçı / doktor / koordinatör(admin) rolleri.
- **Talep girişi:** hasta demografisi (ad, soyad, yaş, kilo, boy), kategori seçimi (7 ana + Plastik/Obezite alt kırılımı zorunlu), operasyon tipi (kategoriye bağlı kontrollü liste), çoklu fotoğraf yükleme, serbest not.
- **Eşzamanlı atama:** talep kategoriye/alt kırılıma tanımlı tüm doktorlara aynı anda düşer.
- **Doktor yanıt akışı:** bekleyen talep sayacı (uygulama içi, Supabase Realtime), talebi açma (`seen_at`), kabul/red (red'de gerekçe zorunlu), kabulde tedavi planı.
- **Çoklu bağımsız yanıt:** her doktor kendi kabul/red + planını verir; tüm planlar toplanır.
- **Koordinatör/admin:** doktor tanımlama + kategoriye atama, tüm talepleri görme, manuel yeniden atama, doktor havuzu düzenleme.
- **Durum yaşam döngüsü** (zaman damgalı; M3 SLA/skoru bu damgalardan türer).
- **İzin sınırı:** doktor yanıtı + tedavi planı aracıya asla görünmez (FR-21).
- **Temel audit log.**
- **Seed verisi:** Rememore tenant, her rolden kullanıcı, 7 kategori + alt kırılım + operasyon tipleri + örnek doktorlar.

### 3.2 Kapsam dışı (sonraki milestone'lar)

- AI triyaj ve dahili uyarı üretimi (M2) — veri modelinde `ai_evaluation` tablosu için yer bırakılır, M1'de doldurulmaz.
- 100 puanlık skor, 24s SLA cron/hatırlatma/eskalasyon zamanlayıcısı (M3). M1 zaman damgalarını toplar; skor kolonu `doctor.score` default 100 durur ama otomatik güncellenmez.
- KVKK fotoğraf silme cron'ları, arşiv katmanı şifreleme, imzalı URL (M4). M1'de fotoğraf yalnızca Storage'da saklanır; `photo.layer` default `active`.
- Mükerrer tespiti / fuzzy eşleştirme (M5). M1'de `patient` kalıcıdır ama otomatik eşleştirme yok.
- Native push, badge, kapalı store dağıtımı (M6).

---

## 4. Teknoloji

| Katman | Seçim | Gerekçe |
|--------|-------|---------|
| Frontend | React + Vite + TypeScript, Tailwind CSS | Mobil-öncelikli responsive, hızlı MVP |
| State/Data | Supabase JS client + TanStack Query | Sunucu durumu senkronizasyonu |
| Backend | Supabase Cloud: Postgres + RLS + Storage + Realtime + Auth | Tenant izolasyonu, dosya, canlı bildirim |
| Bildirim (M1) | Supabase Realtime ile uygulama içi bekleyen sayaç | Native push M6'da |
| Test | Vitest (birim: domain mantığı) + Playwright (uçtan uca) | TDD ile domain katmanı |

**"Rule = Data" ilkesi:** atama ve (ileride) SLA kuralları koda gömülmez; kategori/tenant ayarlarında veri olarak tutulur.

**Supabase projesi:** Yeni bir `medtriage` projesi gerekir. Org'da hâlihazırda 2 aktif proje var; üçüncü aktif proje kota/plan gerektirebilir. **Proje oluşturmadan hemen önce kullanıcıyla netleştirilecek** (yeni proje mi, mevcut birini mi kullanalım).

---

## 5. Veri Modeli (M1)

```
tenant            id, name, settings(jsonb), created_at
app_user          id(=auth.uid), tenant_id, role(enum: agent|sales|doctor|coordinator|admin),
                  full_name, phone, is_active
category          id, tenant_id, name, has_subcategories(bool), assignment_mode
subcategory       id, category_id, name
operation_type    id, category_id, subcategory_id?, name
doctor            id, tenant_id, app_user_id, photo_url, title, specialty,
                  category_id, subcategory_id?, bio, weighted_work(jsonb: etiket+metin),
                  score(int, default 100), is_active
patient           id, tenant_id, first_name, last_name, phone, email        (kalıcı — silinmez)
request           id, tenant_id, patient_id, created_by(app_user),
                  category_id, subcategory_id?, operation_type_id, notes,
                  status(enum), sale_status(enum, default not_completed),
                  created_at, submitted_at, assigned_at
photo             id, tenant_id, request_id, storage_path, uploaded_at,
                  layer(enum: active|archive, default active)
assignment        id, tenant_id, request_id, doctor_id, type(simultaneous|manual),
                  assigned_at, seen_at?
response          id, tenant_id, request_id, doctor_id,
                  decision(accept|reject), reject_reason?, treatment_plan?, responded_at
audit_log         id, tenant_id, actor_id, action, entity, before(jsonb), after(jsonb), created_at
```

### Tasarım kararları

- **`app_user` (kimlik/rol) ile `doctor` (profil kartı + skor + kategori bağı) ayrıdır**, `doctor.app_user_id` ile bağlanır. Böylece "giriş yapmayan ama havuzda tanımlı doktor" temsil edilebilir.
- **`owned_by_doctor_id` / `is_owner` YOK** (bkz. §2). Bir talebe birden çok `response` (doktor başına bir) bağlanabilir.
- **`patient` kalıcı, silinmez** (BRD'nin Hasta ≠ Talep ayrımı). M5'te fuzzy eşleştirme bunun üstüne gelir.
- İleriki milestone kolonları (`ai_evaluation`, skor olayı, arşiv/silme metadata) M1'de eklenmez; şema onları engellemeyecek biçimde tasarlanır.

---

## 6. Güvenlik (RLS & Roller)

- **Davet-bazlı erişim:** self-signup kapalı. Kullanıcı = Supabase Auth kullanıcısı; `app_user` satırı rolüyle bağlanır. Admin/koordinatör kullanıcı oluşturur (M1'de seed + basit admin ekranı).
- **Tenant izolasyonu (RLS):** her tabloda `tenant_id`. Helper fonksiyon `current_tenant_id()` (`auth.uid()` → `app_user.tenant_id`). Politika: kullanıcı yalnızca kendi tenant'ının satırlarını görür.
- **Rol bazlı satır erişimi:**
  - Aracı/satışçı → yalnızca `created_by = kendisi` olan talepler.
  - Doktor → yalnızca kendisine `assignment` düşen talepler; kendi kabul/red + planını yazar; başka doktorun planını göremez.
  - Koordinatör/admin → tenant içindeki her şey.
  - **Kritik izin sınırı:** `response.treatment_plan` ve doktor yanıtı **aracıya asla görünmez** (FR-21). RLS + view seviyesinde ayrıştırılır. Satışçı ve admin görebilir.
- **Audit:** talep kilitleme, atama, yanıt, rol/havuz değişiklikleri `audit_log`'a yazılır.

---

## 7. Uygulama Yapısı

```
src/
  lib/          supabase client, auth context, current_tenant helper
  features/
    auth/       login, davet-bazlı oturum
    requests/   talep girişi (wizard), talep listesi/detay
    doctor/     bekleyen kuyruk + sayaç, talep açma, kabul/red, tedavi planı
    admin/      doktor tanımlama + kategoriye atama, tüm talepler, manuel yeniden atama, havuz düzenleme
    catalog/    kategori/alt kırılım/operasyon tipi (seed + okuma)
  domain/       saf iş mantığı (atama, durum geçişleri) — UI'dan bağımsız, test edilebilir
  components/   ortak UI (kart, rozet-sayaç, foto yükleyici)
```

---

## 8. Çekirdek Akış (Uçtan Uca)

1. **Satışçı** → "Yeni Talep" wizard: hasta bilgileri → kategori (alt kırılım gerekiyorsa zorunlu) → operasyon tipi (kontrollü liste) → foto yükleme → not → **Gönder** (talep kilitlenir, audit başlar, `submitted_at`).
2. Sistem talebi seçilen kategori/alt kırılımdaki **tüm doktorlara eşzamanlı** atar (`assignment` satırları + Realtime sayaç artışı, `assigned_at`).
3. **Doktor** ekranında bekleyen sayaç artar; talebi açar (`seen_at`, durum "Görüldü") → hasta bilgisi + fotoğraflar → **Kabul** (tedavi planı yaz) veya **Red** (gerekçe zorunlu).
4. **Her doktor bağımsız** karar verir; birden çok kabul olabilir, her biri kendi planını yazar. **Hepsi red** → koordinatöre eskalasyon alarmı.
5. **Satışçı/admin** tüm kabul yanıtlarını + planları görür (aracı görmez). Satışçı planları hastaya sunar; hasta seçer. Satışçı sonucu (`sale_done` / `not_completed`) işaretleyebilir (kapanış).

---

## 9. Domain Katmanı (Saf Mantık, TDD)

Kritik iş mantığı UI'dan bağımsız `domain/` içinde saf fonksiyonlar olarak yazılır ve testle sürüklenir:

- `resolveAssignees(request, doctors)` → eşzamanlı hedef doktor listesi (kategori/alt kırılım eşleşmesi).
- `applyDecision(request, responses)` → toplam durum: en az 1 kabul varsa "teklif hazır"; tüm atanan doktorlar red verdiyse "eskalasyon".
- `nextStatus(request, event)` → durum makinesi.

### Durum yaşam döngüsü

```
Taslak → Gönderildi → Atandı → Yanıtlanıyor (≥1 doktor gördü/yanıtladı)
   → En az 1 kabul: "Teklif(ler) hazır" (satışçı planları görür)
   → Tüm atananlar red: "Eskalasyon" (koordinatöre alarm)
   → Kapandı (satışçı sale_done / not_completed işaretler)
```

Per-doktor detay (`seen_at`, kabul/red + plan) `assignment`/`response` satırlarında; talep durumu bunların toplamını yansıtır.

---

## 10. Test Yaklaşımı

- **Vitest birim:** `resolveAssignees` (kategori/alt kırılım eşleşmesi), durum makinesi, "çoklu bağımsız kabul → tüm planlar toplanır", "tüm atananlar red → eskalasyon", RLS politika beklentileri.
- **Playwright uçtan uca:** satışçı talep girer → (çok) doktor kabul eder → satışçı tüm planları görür; **aracı planları göremez** (izin sınırı testi).

---

## 11. Açık Noktalar (M1'i bloke etmez)

- Supabase `medtriage` projesi: yeni mi, mevcut mi (implementation'dan önce netleşecek).
- KVKK aydınlatma/rıza metni yayın öncesi gerekir (M4/dağıtım aşaması).
- `request.selected_doctor_id` (hastanın seçtiği doktor) satış kapanışıyla eklenebilir — muhtemelen M3.
