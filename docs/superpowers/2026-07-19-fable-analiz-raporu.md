# MedTriage — Fable Taze-Göz Analiz Raporu

Tarih: 2026-07-19 · Yöntem: 4 paralel bağımsız denetçi (mimari/kod, güvenlik/RLS, test/operasyon, UX/performans/a11y) + sentez. Kapsam: web (src/), mobil (mobile/), edge fonksiyonları, 23 migration, yapılandırma. Uygulama Opus ile iteratif geliştirildi; bu rapor Fable'ın bağımsız değerlendirmesidir.

## Genel karar

Kod tabanı bir MVP için **disiplinli ve sağlam**: feature-folder yapısı, saf domain katmanı, FR-21 (aracı–tedavi planı) sınırı ve tenant izolasyonu su geçirmiyor; tedavi planları client'tan değiştirilemez; secrets temiz; realtime hijyeni doğru. Ancak **pilot üretime çıkmadan kapatılması şart dört P0 açık** var (altyapı + iki RLS bulgusu) ve orta vadede acıtacak üç yapısal borç (client'ta transaction'sız yazma yolları, el yazması DB tipleri, web↔mobil kopya sapması).

## P0 — Pilot öncesi ŞART (~1-2 gün)

| # | Alan | Bulgu | Etki |
|---|------|-------|------|
| P0-1 | Altyapı | **Repo hiçbir uzak sunucuda değil** (git remote yok) + sıfır CI | Disk arızası = 142 commit dahil her şeyin kaybı; merge kapısı yok |
| P0-2 | Operasyon | **Hata izleme yok** (web/mobil/edge) + **cron'lar sessiz-arızalı** (SLA süpürücü, foto imha — bozulursa kimse duymaz) | Prod hataları ancak kullanıcı şikayetiyle; KVKK imha akışı fark edilmeden durabilir |
| ~~P0-3~~ ✅ | Güvenlik | `assignment` INSERT politikası doctor_id/rol doğrulamıyor → doktor kendini keyfi talebe atayabiliyordu | **ÇÖZÜLDÜ** (migration 0024): atama `assign_request_doctors` RPC'ye indi, client INSERT/DELETE kapandı; canlı: doktor self-assign → 403 |
| ~~P0-4~~ ✅ | Güvenlik | `audit_log` actor client kontrolündeydi → sahtelenebilirdi (ayrıca satışçı/doktor audit'i latent olarak hep patlıyordu) | **ÇÖZÜLDÜ** (0025): client audit tümden kapatıldı, meşru kayıtlar SECURITY DEFINER trigger'larla actor=auth.uid() ile üretiliyor; canlı doğrulandı |

Öneri paketi: GitHub private remote + basit Actions gate (test+build) + Sentry (ücretsiz katman) + 2 cron heartbeat (healthchecks.io) + migration 0024 (assignment WITH CHECK sıkılaştırma, audit'i trigger/definer'a alma).

## P1 — Yapısal borçlar (kısa vade, ~1 hafta)

| # | Alan | Bulgu |
|---|------|-------|
| P1-1 | Mimari | `useCreateRequest` 6+ ardışık yazmayı client'ta transaction'sız yapıyor (hasta→talep→foto→atama): ortada patlarsa **yetim hasta / fotoğrafsız talep**; "tekrar Gönder" mükerrer kayıt. Atama kararı da client'ta (yarış riski + güven sınırı). → Tek RPC/edge function'a indirilmeli |
| P1-2 | Güvenlik | Satışçı/aracı kendi talebini **her statüde silebiliyor** — cascade tedavi planlarını ve AI kayıtlarını da götürür (kanıt imhası). → DELETE'i draft/submitted'a kısıtla |
| P1-3 | Güvenlik | `ai-triage` rate limit'siz: onamı kendisi yazabilen kullanıcı sınırsız Opus çağrısı üretebilir (maliyet istismarı). → kota + sunucu tarafı onam yazımı |
| P1-4 | Bakım | **DB tipleri el yazması ve iki ayrı kopya** (web+mobil), her sorgu denetimsiz cast — 23 migration'lık şemayla kayma derlemede yakalanmaz. → `supabase gen types` |
| P1-5 | Bakım | Web↔mobil "kabul edilmiş kopyalar" **çoktan sapmış** (health/status farklı içerik; AiPanel 156 vs 349 satır). → CI diff-bekçisi veya paylaşılan paket |
| P1-6 | UX | Taslak yalnız bellekte: **sayfa yenilenince form+fotoğraflar kaybolur**, beforeunload uyarısı yok; upload progress yok. → localStorage taslak + guard + ilerleme |
| P1-7 | Perf | **Tek 561 kB JS chunk** (code-splitting sıfır) + **tam boyut fotoğraflar thumbnail olarak** servis ediliyor (resize/lazy yok). → route-lazy + upload resize + transform param |

## P2 — Orta vade

- **Test:** hook'lar ve edge handler'ları sıfır test; RLS için otomatik politika testi yok (tüm doğrulama manuel/canlıydı); tek E2E; mobil E2E yok. En riskli 5 yol raporda işaretli (atama seçimi, manuel atama, ai-triage handler, 0019/0022 politikaları, foto imha sweep'i).
- **Mimari temizlik:** liste zenginleştirmede tenant'ın tüm patient/category tablolarını çekme (N+1 + gereksiz PII) → nested select; invalidation eksikleri (sale status → listeler bayat); audit yazımını DB trigger'a taşıma; kullanılmayan `nextStatus` makinesi (kullan ya da sil); 539 satırlık DoctorAdmin bölünmesi.
- **Güvenlik küçükleri:** patient_id UPDATE guard'ı (0021 yalnız INSERT), create-doctor kategori tenant doğrulaması, photo insert path/layer kısıtı, CORS origin pinleme.
- **UX/a11y:** lightbox dialog semantiği + focus-trap; Toast/AiPanel `aria-live`; kritik hatalarda 4 sn'de kaybolan toast; `window.confirm` → stillenmiş dialog; kip normalizasyonu ("seç…" → siz kipi); mobil offline algısı; doktor alt navigasyonunda tek ikon. (Bunların çoğu bekleyen premium redesign sprintine iliştirilebilir.)
- **Operasyon:** README/RUNBOOK yok; edge secret'ları belgelenmemiş; migration drift doğrulaması (`supabase db diff`); Supabase yedek planı (free tier PITR yok — imha cron'u geri dönüşsüz); EXIF temizleme sessiz fail-open (politika kararı).

## Temiz çıkanlar (güçlü yanlar)

FR-21 çift katmanlı ve sağlam · tenant izolasyonu tüm politikalarda tutarlı · `response` client'tan değiştirilemez/silinemez (plan bütünlüğü) · service-role-only yazma disiplini (ai_evaluation, score_event, app_secret) · webhook'larda sabit-zamanlı secret karşılaştırma · git geçmişinde secret yok · realtime kanal hijyeni · form etiket/a11y temeli · `as any` sıfır · saf domain katmanı test edilmiş (153+27 birim testi).

## Önerilen sıra

1. **P0 paketi** (1-2 gün) → gerçek hastayla pilotun önkoşulu.
2. **P1-1 + P1-2 + P1-3** (yazma yollarının sunucuya inmesi — tek migration+RPC turu).
3. **P1-4/5** (tip üretimi + drift bekçisi — sessiz kırılmaları kapatır).
4. **P1-6/7** UX+perf paketi → bekleyen **premium redesign sprintiyle birleştirilebilir** (a11y/copy P2 kalemleri de oraya).
5. P2 test altyapısı (RLS testleri en değerlisi).
