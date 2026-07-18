# MedTriage — M2: AI Dahili Triyaj + Geri Besleme Döngüsü (Tasarım Spec'i)

**Tarih:** 2026-07-17
**Sürüm:** 1.0
**Kaynak:** MedTriage BRD v2.0 (§7.2, §7.3.2, §7.10, §10)
**Önkoşul:** M1 (çekirdek talep döngüsü) — tamamlandı, main'e merge edildi.
**Kapsam:** M2 — AI değerlendirme çekirdeği (M2a) + geri besleme/öğrenme döngüsü (M2b), tek milestone.

---

## 1. Amaç ve Çerçeve

Talep girildiğinde AI, arka planda dahili bir triyaj yardımcısı olarak çalışır: **fotoğraf + istenen operasyon + hasta demografisi/tıbbi notlar + ilgili doktor kartının bağlamı** arasında tutarlılık değerlendirir ve yapılandırılmış **dahili uyarı** üretir (tip + güven + gerekçe). Çıktı yalnızca dahilidir; doktor/koordinatör/satışçıya görünür, **aracıya asla** ve **hastaya asla** gitmez. AI teşhis/tedavi/onay vermez; başarısız olsa bile talep akışını **bloke etmez** (FR-11).

Doktorlar AI değerlendirmesini "doğru/kısmen/yanlış" işaretler; bu geri bildirimler tenant bazında biriktirilir ve sonraki değerlendirmelere bağlam olarak beslenir ("Rule=Data, Insight=AI" — öğrenme veride, model ağırlığında değil).

---

## 2. BRD'den Bilinçli Sapma — AI Görünürlüğü

BRD FR-8 ve rol tablosu, AI ham çıktısını **doktor + koordinatör** ile sınırlar. **Bu spec bunu bilinçli genişletir** (kullanıcı kararı): AI uyarıları **doktor + koordinatör + satışçı**ya görünür; **aracı (agent) yine göremez**, hastaya yine gitmez. Katı klinik sınırlar (§10.4) değişmez.

---

## 3. Kapsam

### 3.1 Kapsam içi (M2)

**M2a — AI değerlendirme çekirdeği:**
- Supabase **Edge Function `ai-triage`** (Deno): talep + hasta + fotoğraf + doktor kartı bağlamını toplar, Claude'u çağırır, `ai_evaluation` yazar.
- **Claude Opus 4.8** (`claude-opus-4-8`), vision+text, adaptive thinking, `output_config.format` ile yapılandırılmış JSON çıktı.
- **Uyarı tipleri** (§10.2): `photo_operation_mismatch`, `demographics_operation_risk`, `missing_data`, `photo_quality`.
- **Zorunlu disclaimer + model/sürüm loglama** (FR-10) her değerlendirmede.
- **FR-11:** client fire-and-forget çağırır; AI hata/gecikmesi talep akışını durdurmaz. `ai_evaluation.status = 'failed'` durumunda doktor yine yanıtlayabilir.
- **Gösterim:** `DoctorRequestView`'da (doktor) + admin panosunda (koordinatör) + talep detayında (satışçı) AI uyarıları. Aracıya asla.
- **Domain katmanı (TDD):** saf `buildTriagePrompt()`, `parseTriageResponse()`, `summarizeWarnings()` fonksiyonları — edge function'dan bağımsız test edilir.

**M2b — Geri besleme & öğrenme döngüsü:**
- Doktor, `DoctorRequestView`'da AI değerlendirmesini **doğru / kısmen / yanlış** + opsiyonel not olarak işaretler (FR-50, FR-51) → `ai_feedback` (tenant-scoped, FR-52).
- **Bağlam öğrenmesi (FR-53):** edge function bir sonraki değerlendirmede o tenant'ın son N `ai_feedback` kaydını (özellikle 'wrong'+not) prompt bağlamına ekler.
- **Doğruluk raporu (FR-55):** admin panosunda doğru/kısmen/yanlış dağılımı.
- **FR-54 (Could):** `ai_feedback` yapısı ileride fine-tuning dışa aktarımına uygun tutulur; M2'de dışa aktarım yapılmaz.

### 3.2 Kapsam dışı

- Fine-tuning/model ince ayarı çalıştırması (FR-54 yalnız veri yapısı).
- AI'ın hastaya doğrudan yanıt üretmesi (kalıcı kapsam dışı).
- Skor/SLA (M3), fotoğraf yaşam döngüsü (M4), mükerrer (M5), native push (M6).

---

## 4. Teknoloji

| Katman | Seçim | Gerekçe |
|--------|-------|---------|
| AI çağrısı | Supabase Edge Function (Deno) + `npm:@anthropic-ai/sdk` | Anahtar server-side secret; client'a inmez |
| Model | `claude-opus-4-8`, vision+text, `thinking:{type:"adaptive"}` | En doğru tutarlılık/vision değerlendirmesi (kullanıcı kararı); model ID tek yerde, değiştirilebilir |
| Yapılandırılmış çıktı | `output_config.format` (json_schema) | Uyarı listesi + güven + gerekçe garanti şema |
| Fotoğraf | Storage imzalı URL (kısa süreli) → `{type:"url"}` image block | Private bucket; base64 indirmeye gerek yok |
| Tetikleme | Client `supabase.functions.invoke('ai-triage',{requestId})` fire-and-forget | FR-11: bloke etmez |
| Secret | `ANTHROPIC_API_KEY` Supabase Edge Function secret | Anahtar sızmaz |

**Model ID sabiti** tek bir modülde tutulur; değişimi tek satırdır.

---

## 5. Veri Modeli (M2 — 2 yeni tablo)

```
ai_evaluation   id, tenant_id, request_id,
                status(enum: ok | warning | failed),
                warnings(jsonb: [{type, confidence(0..1), rationale}]),
                suitability_note(text),         -- yön gösterici, bağlayıcı değil (FR-9):
                                                -- hastanın talebi + demografi + tıbbi bilgi + fotoğraflara göre
                                                -- hangi işlemlerin uygun/önerilebilir olduğu ve nelere dikkat
                                                -- edilmesi gerektiği hakkında serbest metin AI yorumu
                                                -- (kullanıcı gereksinimi, 2026-07-18)
                disclaimer(text not null),      -- zorunlu (FR-10)
                model(text), model_version(text),
                error(text),                    -- status=failed durumunda
                created_at
                unique(request_id)              -- talep başına bir değerlendirme (yeniden çalıştırma upsert)

ai_feedback     id, tenant_id, request_id, ai_evaluation_id, doctor_id,
                label(enum: correct | partial | wrong),
                note(text),
                created_at
                unique(ai_evaluation_id, doctor_id)   -- doktor başına bir geri bildirim
```

- Uyarı tipi enum'u uygulama/domain katmanında sabit: `photo_operation_mismatch | demographics_operation_risk | missing_data | photo_quality`.
- `ai_evaluation` M1'de yer bırakılmış varlığın gerçeklenmesidir.

---

## 6. Güvenlik (RLS)

- **`ai_evaluation` okuma:** doktor (kendisine atanan talep) + satışçı + koordinatör + admin. **Aracı (agent) HİÇ göremez** (FR-8; response ile aynı desen). Hasta rolü yok.
- **`ai_evaluation` yazma:** yalnız Edge Function (service role) yazar; client insert edemez.
- **`ai_feedback` yazma:** doktor kendi geri bildirimini yazar (`doctor_id = current_doctor_id()`).
- **`ai_feedback` okuma:** koordinatör/admin (raporlama) + yazan doktor. Aracı göremez.
- Tüm satırlar tenant-scoped; `current_tenant_id()` deseni M1'den devralınır.

---

## 7. Uygulama Yapısı (M1'e ek)

```
supabase/functions/ai-triage/
  index.ts            # edge function: bağlam topla → Claude → ai_evaluation yaz
  triage.ts           # saf domain: buildTriagePrompt, parseTriageResponse, summarizeWarnings (test edilir)
src/
  domain/triage.ts    # aynı saf fonksiyonların paylaşılan kopyası VEYA client tarafı tipleri (bkz. §9 notu)
  features/
    doctor/AiWarnings.tsx        # doktor görünümünde AI uyarıları + geri bildirim UI
    requests/RequestAiPanel.tsx  # satışçı talep detayında AI uyarıları (salt-okunur)
    admin/AiAccuracy.tsx         # doğruluk raporu (FR-55)
    ai/useAiEvaluation.ts        # ai_evaluation okuma hook'u
    ai/useAiFeedback.ts          # ai_feedback yazma hook'u
  types/db.ts         # AiEvaluationRow, AiFeedbackRow eklenir
```

---

## 8. Uçtan Uca Akış

1. Satışçı talebi gönderir (M1 akışı: patient→request→photo→assignment). Sonunda client **`functions.invoke('ai-triage',{requestId})`** — fire-and-forget (await edilmez; hata yutulur, FR-11).
2. Edge function: request+hasta+fotoğraf(imzalı URL)+atanan doktor kartları + o tenant'ın son N `ai_feedback` bağlamını toplar.
3. Claude Opus 4.8 (vision+text, adaptive thinking, json_schema) → tutarlılık durumu + uyarı listesi + suitability_note + disclaimer.
4. Edge function `ai_evaluation` satırını **upsert** eder (status ok/warning). Hata olursa `status='failed'`, `error` yazar — talep yine doktorda.
5. Doktor `DoctorRequestView`'da AI uyarılarını görür; **doğru/kısmen/yanlış** işaretler (+not) → `ai_feedback`.
6. Satışçı talep detayında AI uyarılarını salt-okunur görür. Koordinatör admin panosunda görür + doğruluk raporu. Aracı hiçbirini görmez.

---

## 9. Domain Katmanı (Saf Mantık, TDD)

Edge function'dan bağımsız test edilebilir saf fonksiyonlar (`supabase/functions/ai-triage/triage.ts`):

- `buildTriagePrompt(input)` → Claude'a gidecek system+user içerik yapısı (katı-sınır system prompt + hasta/operasyon/doktor-kartı/geri-bildirim bağlamı). Görselleri image block referanslarıyla düzenler.
- `parseTriageResponse(json)` → şemaya uygun `{status, warnings[], suitabilityNote, disclaimer}` çıkarımı; şema dışıysa güvenli `failed`.
- `summarizeWarnings(warnings)` → durum (`ok` uyarı yoksa, aksi `warning`) ve UI özet.
- Uyarı tipi doğrulama (yalnız 4 geçerli tip).

**Not:** Deno edge function ve Vite client farklı runtime. Saf `triage.ts` mantığı edge tarafında yaşar ve orada test edilir (Deno test veya Node'a taşınan saf birim testi). Client tarafı yalnız `ai_evaluation` satırını okur + tipleri paylaşır; prompt mantığını client tekrarlamaz.

---

## 10. Katı Sınırlar (System Prompt — FR-8/9/10, §10.4)

Edge function'ın system prompt'u şunları zorunlu kılar:
- AI **teşhis koymaz, tedavi reçete etmez, operasyon onayı/reddi vermez, hastaya mesaj üretmez.**
- Çıktı **yalnız dahili** karar desteğidir; nihai değerlendirme hekimindir.
- Her çıktıda **zorunlu disclaimer** metni bulunur ve `ai_evaluation.disclaimer`'a yazılır.
- Model adı + sürüm (`model`, `model_version`) her kayıtta loglanır (izlenebilirlik, §NFR).
- Emin değilse/yetersiz veri varsa **bloke etmez**; `missing_data`/`photo_quality` uyarısı üretir veya `failed` döner — talep yine doktora düşmüştür.

---

## 11. Test Yaklaşımı

- **Birim (saf domain):** `buildTriagePrompt` (doğru bağlam + katı-sınır system prompt), `parseTriageResponse` (geçerli/şema-dışı/eksik JSON → güvenli failed), `summarizeWarnings` (ok/warning), uyarı-tipi doğrulama.
- **Edge function entegrasyon (controller, canlı):** gerçek `ai-triage` invoke → `ai_evaluation` satırı oluşur; hata senaryosunda `status='failed'` + talep etkilenmez (FR-11).
- **RLS/izin sınırı (canlı):** aracı `ai_evaluation`/`ai_feedback` okuyamaz (0 satır); satışçı/doktor/koordinatör okuyabilir.
- **Geri besleme (canlı):** doktor doğru/yanlış işaretler → `ai_feedback` satırı; sonraki değerlendirmede bağlam olarak geçtiği doğrulanır (prompt'a eklendiği loglanır).

---

## 12. Açık Noktalar (M2'yi bloke etmez)

- Anthropic API anahtarının Supabase secret'ına eklenmesi (implementation başında, kullanıcı sağlar — kullanıcı "anahtarım var" demişti).
- Bağlam öğrenmesinde N (son kaç geri bildirim) ve token bütçesi — implementation'da ayarlanır; başlangıç N=20.
- Fotoğraf imzalı URL süresi (edge function işlem süresini kapsayacak, örn. 120 sn).
