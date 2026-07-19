# MedTriage P1 — KVKK Onam Akışı + Gizlilik Sertleştirme Tasarımı

Tarih: 2026-07-19 · Gizlilik analizi §K5/O1/O2. Kullanıcı kararları: onam yoksa AI çalışmaz ama talep devam eder; mevcut talepler onamsız sayılır.

## Kavram
Hasta uygulamaya girmez; satışçı WhatsApp'ta onam alır ve uygulamada **beyan eder**. Uygulama onamın alındığının **kaydını** tutar. AI (yurt dışı aktarım) yalnız onam varsa çalışır. Aydınlatma metni herkese açık statik sayfa; linki WhatsApp'ta paylaşılır.

## Veri modeli (migration 0022)
- `request` += `consent_at timestamptz`, `consent_channel text`, `consented_by uuid references app_user(id)`. Onam = consent_at NOT NULL. Mevcut satırlar NULL (onamsız).
- `patient` += `created_by uuid references app_user(id)` (RLS daraltması için; mevcutlar NULL kalır).
- **patient RLS daraltma (O1):** `tenant_read_patient` (tenant'ta herkes okur) kaldırılır; yerine: koordinatör/admin tüm tenant; doktor atandığı taleplerin hastaları; agent/sales yalnız `created_by = auth.uid()` VEYA kendi oluşturduğu bir talebe bağlı hasta. Böylece aracı tüm hastaların telefon/e-postasını göremez. (M5 `find_patient_matches` SECURITY DEFINER — etkilenmez; dedup çalışmaya devam eder.)

## AI onam kapısı (K5)
- **Client:** `useCreateRequest` — talep oluşturulduktan sonra `ai-triage` invoke'u **yalnız onam verildiyse** yapılır (consentGiven true). Onam yoksa invoke edilmez.
- **Edge (savunma derinliği):** `ai-triage` başında `request.consent_at` NULL ise değerlendirme üretmeden döner (`{ ok: true, skipped: 'no_consent' }`) — Anthropic'e hiçbir veri gitmez. failed kaydı da yazılmaz.
- Böylece riskli tek adım (yurt dışı aktarım) çift katmanlı onama bağlanır.

## Onam UI
- **Wizard:** "Onam" bölümü (opsiyonel, gönderimi bloke etmez): checkbox "Hastadan aydınlatma metni paylaşıldı ve yurt dışı aktarım dahil açık rıza alındı (WhatsApp)" + `/aydinlatma` linki (yeni sekme). İşaretliyse consent_at=now, consent_channel='whatsapp', consented_by=kullanıcı. İşaretin yanında küçük not: "İşaretlenmezse AI ön değerlendirmesi yapılmaz."
- **RequestDetail (satış/koord/admin RoleGate içinde):** onam durumu satırı — verildiyse "Onam alındı ({tarih}, WhatsApp)"; yoksa amber "Onam alınmadı — AI ön değerlendirmesi yapılmadı". AiPanel zaten veri yoksa sessiz; bu satır nedeni açıklar.
- **Aydınlatma sayfası** `/aydinlatma`: kimliksiz (public route), statik Türkçe KVKK aydınlatma metni + AI işleme + yurt dışı aktarım maddesi. **Placeholder metin** — kullanıcı KVKK danışmanı onaylı nihai metni koyacak (dosyada belirgin TODO/uyarı).

## Font self-host (O2)
`index.css`'teki Google Fonts `@import` kaldırılır; `@fontsource/fraunces` + `@fontsource/plus-jakarta-sans` paketleri kurulup `main.tsx`'te import edilir. Böylece kullanıcı IP'leri Google'a gitmez (GDPR/KVKK). Tailwind font-family tokenları aynı kalır.

## Kapsam dışı
Onamın hasta tarafından tıklanabilir link/OTP ile verilmesi (WhatsApp Business API — ileride); hasta silme self-servisi; DPA/ZDR (kullanıcı aksiyonu, Anthropic Console).

## Test & doğrulama
- Birim: consent gate mantığı (client invoke koşulu) — mevcut testlere ek; patient RLS için canlı token testi.
- Canlı: onamlı talep → AI çalışır; onamsız talep → AI çalışmaz (ai_evaluation satırı oluşmaz), talep yine doktora gider; agent başka satışçının hastasını okuyamaz (RLS); /aydinlatma kimliksiz açılır; fontlar Google'a istek atmaz (network sekmesi). Web 153 test + E2E + build yeşil (E2E onam bölümüyle bozulmaz — opsiyonel).
