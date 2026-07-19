# MedTriage M4 — KVKK Fotoğraf Yaşam Döngüsü Tasarımı

Tarih: 2026-07-19 · BRD §7.8 (FR-30b/31/32/33/34/35/36/37/38/39). Kapsam kararı: otonom (kullanıcı "M4'ü bitir").

## Kavram (BRD §7.8)
Üç aşamalı yaşam döngüsü, `request.sale_status` ile sürülür:
- **not_completed** (varsayılan): satış tamamlanmadı → fotoğraflar aktif katmanda, **yüklemeden 60 gün** sonra otomatik silinir (FR-33).
- **sale_done**: satış tamamlandı → fotoğraflar aktif→**arşiv** katmanına TAŞINIR (tek nüsha), imha edilmez (FR-32); talep kapanır (FR-31).
- **operation_done**: ameliyat oldu → **30 gün tampon** sonra imha (FR-35).
Doktor RED'i ≠ satış yapılamadı (bağımsız — FR-30b).

## Kural=Veri
`tenant` += `photo_retention_days int default 60`, `photo_op_buffer_days int default 30`. Süreler koda gömülmez.

## Veri modeli (migration 0016)
- `request` += `sale_marked_at timestamptz` (sale_status en son ne zaman değişti — operation_done tamponunun başlangıcı).
- `photo` += `deleted_at timestamptz`, `deletion_reason text` (imhadan sonra satır KALIR; "silinmişlik metadata" FR-39). storage_path korunur ama nesne silinir.
- RLS güncellemesi (FR-36): `photo_read` — arşiv katmanı satır düzeyinde de agent/sales'e kapanır: creator (agent/sales) yalnız `layer='active'` görebilir; coordinator/admin ve atanan doktor her katmanı görür.
- audit_log mevcut; her taşıma/silme/arşiv-erişim buraya yazılır (FR-38/39).

## Kapanış & işaretleme (FR-30b/31/34)
- `useSetSaleStatus()` mutation: `request.sale_status` + `sale_marked_at=now()` günceller; audit'e 'sale_status_change' yazar. sale_done ise `status='closed'`. Ardından sale_done'da `photo-lifecycle` fonksiyonunu `{mode:'archive', requestId}` ile fire-and-forget çağırır (taşıma anlık başlasın, cron beklemesin).
- Yetki: not_completed/sale_done → satışçı+koordinatör+admin; operation_done → koordinatör+admin (FR-34). RLS: request UPDATE'te sale_status için mevcut politikalar + yeni WITH CHECK; operation_done'ı yalnız koordinatör/admin set eder (trigger guard).

## Edge fonksiyonu `photo-lifecycle`
İki mod, JWT+secret ayrımı:
- **mode='archive'** (JWT'li kullanıcı, sale_done sonrası): talebin aktif fotoğraflarını `<tenant>/archive/<request>/...` yoluna kopyala → orijinali sil → `photo.layer='archive'`, storage_path güncelle → audit 'photo_archived'. Yetki: koordinatör/admin veya talebin satışçısı.
- **mode='sweep'** (x-webhook-secret, pg_cron): (a) not_completed + `uploaded_at + retention_days` geçmiş + layer='active' + deleted_at IS NULL → Storage'dan sil, `deleted_at/deletion_reason='retention_60d'` yaz, audit 'photo_purged'; (b) operation_done + `sale_marked_at + op_buffer_days` geçmiş + deleted_at IS NULL → sil, reason='operation_30d', audit.
- `run_photo_lifecycle_sweep()` (SECURITY DEFINER, revoke public) pg_cron günde bir (`0 3 * * *`) → secret'le fonksiyonu çağırır.

## Arşiv erişimi `photo-url` (FR-37/38)
Arşiv fotoğrafları client'ta doğrudan `createSignedUrl` ile DEĞİL; `photo-url` edge fonksiyonu üzerinden: caller JWT → rol/atama kontrolü (agent/sales arşive erişemez) → service-role kısa imzalı URL (120sn) → audit 'archive_access' (kim/ne zaman/hangi dosya). Aktif fotoğraflar bugünkü gibi doğrudan imzalı URL (değişmez). **Not (bilinçli sapma):** FR-37 "uygulama seviyesinde şifreleme" pilotta byte-düzeyi yerine private bucket + at-rest şifreleme (Supabase) + sıkı RLS + denetimli kısa imzalı URL ile karşılanır; byte-düzeyi şifreleme (istemci anahtar yönetimi gerektirir) followup.

## UI
- **RequestDetail (satışçı/koordinatör görünümü):** "Satış Durumu" bölümü — mevcut sale_status rozeti + aksiyonlar: "Satış yapıldı" / "Satış olmadı" (satışçı+); "Ameliyat yapıldı" (koordinatör+). Fotoğraf durum satırı: not_completed → "Fotoğraflar {kalan} gün sonra silinecek"; sale_done → "Fotoğraflar arşivlendi"; operation_done → "İmha: {kalan} gün".
- **Silinmiş fotoğraf:** PhotoGrid'de imha edilmiş fotoğraf yerine soluk kutu "Fotoğraf KVKK gereği imha edildi ({tarih})" (deleted_at dolu satırlar).
- Doktor görünümü arşiv fotoğraflarını `photo-url` ile yükler (aktifken doğrudan).

## Kapsam dışı (M5/sonra)
Mükerrer tespiti + "Fotoğraf yeniden gerekli" bayrağı (7.9.2 → M5); byte-düzeyi şifreleme; hasta silme talebi self-servisi.

## Test & doğrulama
- Birim: retention/buffer gün hesap yardımcısı (`photoLifecycle.ts`), sale_status geçiş yetki matrisi.
- Canlı: retention_days=0 hilesiyle sweep → not_completed foto silinir + deleted_at/audit; sale_done → arşive taşınır (storage path değişir, agent göremez — RLS 0 satır); operation_done + buffer=0 → imha; arşiv erişim audit'i; UI rozet/aksiyonları; agent arşiv fotoğrafına DB-token ile erişemez. Web 135 + mobil + build yeşil; ayarlar 60/30'a geri.
