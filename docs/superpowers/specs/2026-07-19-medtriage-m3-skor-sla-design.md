# MedTriage M3 — Skor Otomasyonu + SLA + Eskalasyon Tasarımı

Tarih: 2026-07-19 · BRD: §6.2 (100 puanlı sistem), FR-24/25/26 (SLA & eskalasyon), FR-29/29b (gecikme panosu + doktor hız görünümü). Kullanıcı kararları: hatırlatma SLA'dan 4 saat önce; skor sıfırdan başlar (geçmiş puanlanmaz); SLA 24 saat (tenant ayarı).

## 1. Kurallar (BRD §6.2, FR-24/25)
- SLA: yanıt (kabul VEYA red) `assignment.assigned_at` + `tenant.sla_hours` (vars. 24) içinde gelmeli.
- Puan: zamanında yanıt **+1**, aşım **−1**. Her atama için **tek nihai olay** (unique assignment_id — mükerrer ceza/ödül imkânsız). "Hiçbir doktor yanıtlamazsa hepsi −1" kuralı, atama-başına cezanın doğal sonucudur.
- `doctor.score`: 100 başlar, olaylardan türetilir, 0–100 kelepçeli (tavan aşılmaz, taban altına inilmez). **< 10 → "çalışılmaz"** (kırmızı rozet, koordinatör panosunda işaretli).
- Hatırlatma: SLA dolmadan `tenant.sla_reminder_hours` (vars. 4) önce doktora push (token yoksa sessiz); atama başına bir kez (`assignment.reminder_sent_at`).
- Rule=Data: `sla_hours`/`sla_reminder_hours` tenant kolonları; kod sabiti yok.

## 2. Veri modeli & motor (migration 0014)
- `score_event` { id, tenant_id, doctor_id→doctor, request_id→request, assignment_id→assignment **unique**, delta smallint (+1/−1), reason ('timely_response'|'sla_breach'), created_at } — dönemsel görünümler bu tablodan (BRD "Puan Olayı").
- `tenant` += sla_hours int default 24, sla_reminder_hours int default 4. `assignment` += reminder_sent_at timestamptz.
- Trigger A (response INSERT sonrası): ilgili assignment bulunur; responded_at − assigned_at ≤ SLA → +1 'timely_response', değilse −1 'sla_breach'; `on conflict (assignment_id) do nothing` (cron önce cezalandırdıysa dokunma).
- Trigger B (score_event INSERT sonrası): `doctor.score = greatest(0, least(100, score + delta))`.
- `run_sla_sweep()` (SECURITY DEFINER): (a) yanıtsız + süresi dolmuş atamalara −1 'sla_breach' (on conflict nothing); (b) yanıtsız + hatırlatma penceresine girmiş + reminder_sent_at IS NULL atamalar için `notify-sla` fonksiyonuna pg_net POST (app_secret başlığıyla) + reminder_sent_at damgala.
- pg_cron: `*/15 * * * *` → `select run_sla_sweep()`.
- RLS: score_event SELECT koordinatör/admin VEYA kendi doktoru; INSERT/UPDATE client policy YOK (trigger/definer yazar).

## 3. Bildirim: `notify-sla` Edge Function
notify-assignment deseni (verify_jwt=false + x-webhook-secret sabit-zamanlı karşılaştırma). Body {assignment_id}. Doktorun push token'larına: başlık "SLA hatırlatması", metin "Yanıt bekleyen talep: {operasyon} — yaklaşık {sla_reminder_hours} saat kaldı." (hasta adı YOK — kilit ekranı gizliliği). data.requestId → mobil deep link. Hata yutulur.

## 4. Koordinatör UI (FR-26/29/29b)
- **AllRequests → Gecikme Panosu**: filtre sekmeleri Tümü / Bekleyen (yanıt bekliyor, SLA içinde) / **Geciken** (SLA aşıldı, kırmızı "SLA aşıldı · Xs" rozeti) / Tamamlanan. Geciken satırlar amber-kırmızı vurgulu; müdahale mevcut yeniden atama akışıyla.
- **DoctorAdmin kartları**: güncel skor rozeti (<10 kırmızı "Çalışılmaz"), zamanında/geç sayıları + ort. yanıt süresi (score_event + response'tan), **dönemsel skor**: hazır "Son 1 ay" + serbest tarih aralığı seçimi → aralıktaki net değişim (+X/−Y) ve aylık net değişim mini listesi (son 6 ay). Grafik kütüphanesi eklenmez; basit çubuk/metin.

## 5. Doktor UI (web + mobil)
Kuyruk satırlarında kalan süre rozeti: `slaBadge(assignedAt, slaHours)` → ">12s: nötr · ≤4s: amber 'SLA: Xs kaldı' · aşım: kırmızı 'SLA aşıldı'". Mobil kopya aynı mantık (domain kopyası + testler).

## 6. Kapsam dışı (BRD ile uyumlu)
Otomatik yeniden atama (eskalasyon manuel kalır — BRD açık), e-posta bildirimi, "görüldü" (seen_at) SLA'sı, aylık trend çizgisi grafiği (mini liste yeterli; ileride).

## 7. Test & doğrulama
- Birim: SLA hesap/rozet yardımcıları (web vitest + mobil jest), skor kelepçe uçları.
- Canlı: tenant sla_hours geçici 0 → sweep elle çalıştır → −1 olaylar + Geciken sekmesi + skor düşüşü; yanıt ver → +1 (unique kısıt: çifte olay yok); skor <10 senaryosu SQL ile kurulup "Çalışılmaz" rozeti doğrulanır; sla_hours=24 geri alınır. pg_cron job kaydı doğrulanır. E2E + 121 test + build yeşil kalır.
