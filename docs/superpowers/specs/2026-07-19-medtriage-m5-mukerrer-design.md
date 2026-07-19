# MedTriage M5 — Mükerrer Kayıt & Hasta Kimliği Tasarımı

Tarih: 2026-07-19 · BRD §7.9 (FR-40..FR-45). Otonom ("M5 devam").

## Kavram
Kalıcı **Hasta** kimliği ≠ geçici **Talep** olayı (FR-40; şema zaten patient 1:N request). Bugün wizard her seferinde YENİ hasta açıyor ve telefon almıyor — M5 önce telefonu (dedup birincil anahtarı) ekler, sonra girişte gerçek zamanlı bulanık eşleştirme yapıp satışçıya "aynı hasta / farklı kişi" kararını bloke etmeden sunar.

## Veri modeli (migration 0020)
- `request` += `photos_required boolean not null default false` (FR-44 bayrağı).
- `create extension if not exists pg_trgm` (isim bulanık eşleşmesi).
- RPC `find_patient_matches(p_phone text, p_first text, p_last text)` SECURITY DEFINER, tenant içeride `current_tenant_id()` ile filtrelenir (definer RLS'i baypas eder). Döner (aday hasta başına):
  `patient_id, first_name, last_name, phone, request_count, last_request_at, last_status, has_open_request, has_available_photos, had_deleted_photos, match_reason ('phone'|'name')`.
  Aday: normalize(phone) = normalize(girdi) (son 10 hane) VEYA `similarity(first||' '||last, girdi_isim) > 0.3`. Sıralama: phone eşleşmesi önce, sonra benzerlik. `has_open_request` = status <> 'closed' talep var. `has_available_photos` = deleted_at IS NULL foto; `had_deleted_photos` = deleted_at dolu foto.
- İsteğe bağlı normalize telefon index'i (küçük veri, şart değil).

## Client dedup akışı (FR-41/42/43)
- Wizard'a **Telefon** alanı (zorunlu; `normalizePhone` domain yardımcısı: rakamlar, +90/0 soyulup son 10 hane).
- Telefon (≥7 hane) + ad + soyad girilince **debounce (400ms)** ile RPC. Eşleşme varsa **bloke etmeyen panel** (FR-42): "Bu bilgilerle {N} olası eşleşme" — her aday: ad, telefon, başvuru sayısı, son tarih+durum (Türkçe), foto durumu ("fotoğraflar mevcut"/"önceki fotoğraflar silinmiş"), açık talep rozeti.
- Her adayda "Aynı hasta" → seçilir (mevcut patient_id'ye bağlanır, panelde "Mevcut hastaya bağlanıyor: X"); "Farklı kişi (yeni kayıt)" → seçim temizlenir, yeni hasta açılır (FR-43).
- Seçilen adayda `had_deleted_photos && !has_available_photos` → yeni talebe `photos_required=true` + amber uyarı "Fotoğraf yeniden gerekli: önceki fotoğraflar KVKK gereği silinmiş, güncel fotoğraf ekleyin" (FR-44). Wizard zaten foto zorunlu tuttuğundan gönderim doğal bloke; bu satır yalnız yönlendirir.
- Seçilen adayda `has_open_request` → info "Bu hastanın doktor yanıtı bekleyen başka talebi var" (FR-45).

## useCreateRequest değişikliği
Opsiyonel `existingPatientId?: string` + `photosRequired?: boolean`. existingPatientId varsa hasta insert'i atlanır, telefon **yeni hasta**da kaydedilir; request.photos_required yazılır. (Telefon güncellemesi kapsam dışı — mevcut hasta telefonu değiştirilmez.)

## FR-45 karşılıklı haberdarlık
- Wizard: yukarıdaki açık-talep info.
- RequestDetail: `useSiblingOpenRequests(patientId, currentRequestId)` — aynı hastanın başka `status<>'closed'` talebi varsa üstte info bandı "Bu hastanın başka açık talebi var ({N})". Salt gösterim; otomatik birleştirme YOK (BRD MVP kararı).

## Kapsam dışı
Otomatik talep birleştirme; telefon düzenleme; hasta birleştirme (merge); geçmiş talep listesi ekranı (özet yeterli).

## Test & doğrulama
- Birim: `normalizePhone` (web+mobil değil, yalnız web wizard); RPC eşleşme mantığı için domain yok (DB) — canlı SQL testi.
- Canlı: iki farklı yazımlı aynı telefonla iki talep → ikincide panel eşleşme gösterir; "Aynı hasta" → tek patient'a iki request; silinmiş fotolu hastada photos_required + uyarı; açık talep rozeti; farklı kişi → ayrı hasta. Web 143 test + E2E + build yeşil (E2E telefon alanı ekiyle güncellenir).
