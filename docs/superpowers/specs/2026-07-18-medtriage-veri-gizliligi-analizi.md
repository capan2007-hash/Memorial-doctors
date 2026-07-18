# MedTriage Veri Gizliliği Analizi — LLM'e Giden Veri + Genel PII Yüzeyi

Tarih: 2026-07-18 · Kapsam: M2 sonrası kod tabanı (`feature/m2-ai-triage`) + Supabase canlı yapılandırma.

## 1. LLM'e (Anthropic API) şu an giden veri envanteri

`ai-triage` Edge Function → `buildUserContent()` ile giden içerik:

| Veri | Kaynak | PII riski | Not |
|---|---|---|---|
| Hasta fotoğrafları (yüz dahil) | `photo` bucket, 300 sn imzalı URL | **Yüksek** — biyometrik nitelikte | Değerlendirmenin konusu; tamamen kaldırılamaz |
| Diş röntgenleri | aynı | Orta | |
| Yaş, cinsiyet, boy, kilo | `request` | Düşük (tek başına) | Değerlendirme için gerekli |
| Geçmiş ameliyatlar / hastalıklar / ilaçlar | `request` serbest metin | **Orta-Yüksek** | Serbest metin: hastane/hekim adı, tarih, kimlik bilgisi girilebilir |
| Talep notu (`notes`) | `request` serbest metin | **Orta-Yüksek** | Satışçı hasta adı/telefonu yazabilir |
| Operasyon kategori/tip adları | lookup | Yok | |
| Doktor kartları (unvan, branş, bio) | `doctor` | Düşük (doktor PII'ı) | Bio gerçek isim içerebilir |
| Geri bildirim ipuçları (not + özet) | `ai_feedback` | Orta | Doktor notu serbest metin |

**Gitmeyen:** hasta adı-soyadı (prompt metninden bilinçli hariç; testle sabitlenmiş), telefon, e-posta, TC kimlik.

## 2. Bulgular (öncelik sıralı)

### K1 — Fotoğraf dosya adında hasta adı olabilir; bu ad Anthropic'e giden URL'de taşınır
`usePhotoUpload.ts`: `path = tenant/request/UUID-${file.name}`. Kullanıcı "deniz_bardakci_burun.jpg" yüklerse ad storage yoluna, oradan imzalı URL'e ve Anthropic istek kayıtlarına girer.
**Önlem:** dosya adını tamamen at — yalnız `UUID.uzantı` kullan.

### K2 — EXIF metadata temizlenmiyor
Telefon fotoğrafları GPS konumu, cihaz kimliği, çekim tarihi taşır; ham dosya hem storage'a hem (URL üzerinden) Anthropic'e gider.
**Önlem:** client'ta yüklemeden önce canvas re-encode ile EXIF strip (JPEG/PNG/WebP).

### K3 — Serbest metin alanları maskesiz gidiyor
Tıbbi 3 alan + not + doktor geri bildirim notu, PII scrubber'dan geçmeden prompt'a giriyor.
**Önlem:** `scrubPii()` (saf fonksiyon, TDD): TC kimlik (11 hane), telefon, e-posta, IBAN kalıplarını `[maskelendi]` ile değiştir; Edge Function'da prompt'a girmeden uygula.

### K4 — `fullName` hâlâ TriageContext'te taşınıyor
Prompt metnine yazılmıyor ama alan mevcut; ileride bir değişiklikle kazara sızma riski (tek satır koruma: alanı tamamen kaldır).
**Önlem:** `TriagePatient.fullName` alanını sil; sistem prompt'una "hastanın adını asla kullanma/yazma" talimatı ekle (savunma derinliği).

### K5 — Anthropic ile veri işleme çerçevesi eksik (KVKK)
API varsayılanı eğitimde kullanmama; ancak: (a) DPA/veri işleme sözleşmesi onaylanmalı (console → ticari şartlar), (b) mümkünse Zero Data Retention talep edilmeli, (c) KVKK m.9 yurtdışı aktarım için hastadan **açık rıza** alınmalı (ABD'ye sağlık verisi + fotoğraf aktarımı).
**Önlem:** talep formuna zorunlu onam kutusu + `request.consent_at` alanı; onam yoksa AI değerlendirmesi atlanır (`failed/skipped` kaydı). Aydınlatma metnine AI işleme + yurtdışı aktarım maddesi.

### O1 — `patient` tablosunu tenant'taki HERKES okuyabiliyor
`tenant_read_patient`: agent dahil tüm roller tüm hastaların telefon/e-postasını okur. Aracının yalnız kendi getirdiği hastaları görmesi beklenir (M1.5 IDOR bulgusuna benzer).
**Önlem:** agent için `created_by` bazlı daraltma; telefon/e-postayı ayrı policy ya da view ile yalnız sales/coordinator'a aç.

### O2 — Google Fonts CDN
`index.css` Google'dan font çeker → kullanıcı IP'leri Google'a gider (GDPR içtihadı: ihlal sayılabilir).
**Önlem:** fontları self-host et (`@fontsource/*`).

### O3 — Fotoğraf yaşam döngüsü yok (mevcut backlog M4)
Süresiz saklama; KVKK saklama/imha politikası gerekiyor (örn. talep kapandıktan N gün sonra arşiv/sil). `layer: active/archive` alanı zaten hazır.

### O4 — `ai_evaluation.error` kolonu
Şu an yalnız hata mesajı yazılıyor (hasta verisi yok) — böyle kalmalı; prompt içeriği asla loglanmamalı. Edge Function内 `console.log` yok ✓.

### İyi durumda olanlar
Bucket private + 300 sn imzalı URL ✓ · taslak yalnız bellekte, çıkışta temizleniyor ✓ · client'ta console.log PII yok ✓ · tedavi planı/AI çıktısı agent'tan çift katmanlı gizli ✓ · Supabase eu-central-1 (AB) ✓ · anahtar yalnız edge secret ✓.

## 3. Önerilen uygulama planı

- **P0 (hemen, ~1 gün):** K1 dosya adı, K2 EXIF strip, K3 scrubPii, K4 fullName kaldırma + prompt talimatı.
- **P1 (bu hafta):** K5 onam akışı (form + consent_at + aydınlatma metni linki), O1 patient RLS daraltma, O2 font self-host. DPA/ZDR: kullanıcı aksiyonu (console).
- **P2 (M4 ile):** O3 saklama/imha, erişim loglama, VERBİS/envanter dokümantasyonu, hasta silme talebi akışı (cascade zaten kurulu).
