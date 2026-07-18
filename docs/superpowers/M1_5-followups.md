# MedTriage M1.5 — Ertelenen Takip İşleri (final review triyajı)

M1.5 merge'i için kabul edilen, sonraki iterasyona bırakılan işler. İki Important blocker merge öncesi çözüldü (doctor_scope INSERT rol predikatı; create-doctor yetim hesap koruması). Aşağıdakiler acceptable-follow-up.

## Güvenlik / RLS (aynı sınıf, M1'den miras)
- **M1 admin politikaları WITH CHECK sweep'i:** `doctor_admin_all`, `req_admin_all`, `patient_admin_all` (migration 0002) `with check`'lerinde rol predikatı eksik — doctor_scope'ta düzeltilen aynı sınıf. Aynı-tenant non-admin kullanıcı bu tablolara doğrudan INSERT edebilir (ör. agent doctor/request/patient satırı). M1'de zaten shipped; ayrı bir güvenlik turunda süpürülmeli. Not: `asg_doctor_rw` (assignment) WITH CHECK'i kasıtlı gevşek — client-side atamada sales assignment satırı ekliyor; bunu sıkılaştırmak için atama server-side'a (trigger/RPC) taşınmalı.
- **Tenant-çapraz kategori id doğrulaması yok:** `create-doctor` ve `set_doctor_scopes` verilen category/subcategory id'sinin çağıranın tenant'ına ait olduğunu doğrulamıyor. Düşük etkili (`resolveAssignees` tenant'a göre filtreliyor, yabancı scope eşleşmez) ama bütünlük açığı.

## Veri modeli / kısıtlar
- **Demografi DB kısıtları:** `age/weight_kg/height_cm/gender` DB'de nullable, yalnız client-tarafı zorunlu. Doğrudan API insert wizard doğrulamasını atlayabilir. Follow-up: `NOT NULL` + `CHECK (age>0 ...)`. (Üç tıbbi metin alanı zaten `NOT NULL DEFAULT 'Yok'`.)
- **Legacy `doctor.category_id`/`subcategory_id`:** artık `resolveAssignees` yalnız `doctor_scope` okuyor; bu kolonlar create-anında NOT NULL'ı doldurmak için duruyor, scope düzenlemesiyle senkronsuz kalıyor. İleride kaldırılabilir.
- **`doctor_scope` unique NULL alt-kırılımı dedupe etmiyor** (Postgres NULL'ları distinct sayar). UI toggle'ları engelliyor; DB düzeyinde koruma için `NULLS NOT DISTINCT` (PG15+) veya partial unique index.

## UX / kod kalitesi
- **`useRequestDetail`/`DoctorRequestView` null guard yok:** kötü/silinmiş talep id'sinde `req.patient_id` patlar → sonsuz "Yükleniyor…". Null guard + hata durumu eklenmeli (yakında).
- **`signPhotoUrls` tekrarı** (`useRequests.ts` + `DoctorRequestView.tsx`) — paylaşılan yardımcıya çıkar.
- **`<img>` alt yok** (talep/doktor foto & röntgen grid'leri) — a11y.
- **Diş kategorisi string eşleşmesi** (`name === 'Diş Tedavisi'`): kategori yeniden adlandırılırsa röntgen yükleyici sessizce kaybolur — `category` capability flag'i tercih edilmeli.
- **DoctorAdmin yeni doktor foto yükleme yarışı:** foto sonraki refetch'e kadar görünmeyebilir (kozmetik).
- **`toggleActive` tüm scope'ları yeniden yazıyor:** basit aktif/pasif için `set_doctor_scopes` delete+insert yapıyor; `isActive`-only yol eklenebilir.
- **E2E combobox pozisyonel selector'ları** (`nth(0)/nth(1)`): JSX sırasına bağlı; etiketli/rol+ad selector'a geçilmeli.

## Kapsam gereği ertelenenler
- M2: AI dahili triyaj + geri besleme (spec hazır).
- M3: skor otomasyonu (+1/−1) + SLA + eskalasyon zamanlayıcısı.
- M4: KVKK fotoğraf yaşam döngüsü. M5: mükerrer tespiti. M6: native + push.
