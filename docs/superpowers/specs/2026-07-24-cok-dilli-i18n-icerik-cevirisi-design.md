# Çok-Dilli Arayüz (i18n) + Görüntüleyene Göre İçerik Çevirisi — Tasarım

**Tarih:** 2026-07-24 · **Durum:** Onaylandı (kullanıcı) · **Kapsam:** Web + Mobil

## 1. Amaç

MedTriage'ı iki eksende dil-bariyersiz hale getirmek:

1. **Statik arayüz i18n:** Uygulamanın tüm sabit metinleri (butonlar, etiketler,
   başlıklar, boş-durum/hata metinleri) birden çok dilde. **İlk faz: Türkçe (kaynak),
   Arapça, İngilizce.** Sonraki faz: Rusça, Almanca, Fransızca.
2. **Görüntüleyene göre içerik çevirisi:** Kullanıcıların girdiği serbest-metin içerik
   (hasta notları, tıbbi geçmiş, tedavi planı, red gerekçesi) her okuyucuya **kendi
   arayüz dilinde** gösterilir. Örn. Arapça kullanan satışçının girdiği hasta bilgisi,
   Türkçe kullanan doktora Türkçe görünür; doktorun Türkçe yazdığı yanıt satışçıya
   Arapça döner. Çift yönlü.

## 2. Onaylanan Kilit Kararlar

| Karar | Seçim |
|---|---|
| Çeviri motoru (içerik) | **Claude API** (Anthropic tekli sağlayıcı, tıbbi bağlam) |
| Çeviri zamanı | **Okuma-anında + önbellek** (yalnız görüntülenen içerik çevrilir) |
| Arapça düzen | **Tam RTL yansıtma** (`dir="rtl"`) |
| Otomatik çeviri güvenliği | **Varsayılan çeviri + "orijinali göster" geçişi + "otomatik çeviri" etiketi** |
| Dil tercihi saklama | **Kullanıcıya bağlı** (`app_user.language`, cihazlar arası senkron) |
| İlk faz dilleri | **TR + AR + EN** (RTL ilk fazda, çünkü AR var) |

## 3. Mimari

### 3.1 Statik arayüz i18n

- **Kütüphane:** `i18next` + `react-i18next` (web); aynısı + `expo-localization` (mobil,
  cihaz dili algılama için).
- **Bundle yapısı:** `src/i18n/locales/<lang>/<namespace>.json`. Namespace'ler
  özellik-bazlı (`common`, `requests`, `doctors`, `admin`, `auth`, `ai`…).
- **Kullanım:** Her sabit metin `t('namespace.key')` ile. Enterpolasyon (`{{count}}`)
  ve çoğul desteklenir.
- **Dil algılama sırası:** `app_user.language` (giriş yapılmışsa) → cihaz/tarayıcı dili
  → `tr` fallback.
- **Dil değiştirici:** Web Layout header'ında; mobil profil ekranında. Seçim
  `app_user.language`'a yazılır (giriş yapılmışsa) + yerel depoya (async-storage /
  localStorage) yansıtılır.
- **İlk çeviriler:** AR + EN bundle'ları Türkçe kaynaktan Claude ile **toplu üretilir**,
  commit'lenir, sonradan elle düzeltilebilir.

### 3.2 RTL (Arapça)

- `<html dir="rtl">` (web) / RN `I18nManager` mantığı yerine layout-yön farkındalığı
  (mobil).
- Tailwind **mantıksal** yardımcı sınıflara geçiş: `ps-*/pe-*` (padding-inline),
  `ms-*/me-*`, `text-start/text-end`, `start-*/end-*`. Sabit `left/right` yalnız yön-nötr
  yerlerde kalır.
- Yön-duyarlı ikonlar (ok, chevron, "geri") RTL'de aynalanır.
- Amaç: Arapça seçilince tüm arayüz sağdan-sola tutarlı görünür.

### 3.3 Katalog adları (kategori / alt kırılım / operasyon)

- Dropdown'larda her yerde göründükleri için **okuma-anı çeviri gecikmesi istenmez**.
- Çözüm: Katalog tablolarına `name_i18n jsonb` sütunu. Migration'da bir kereye mahsus
  Claude ile TR+AR+EN'e çevrilip seed edilir; sonradan elle düzeltilebilir.
- Görüntülemede `name_i18n->>lang` okunur, yoksa `name` (tr) fallback.

### 3.4 İçerik çevirisi (ana özellik)

**Kaynak dil:** Yazan kullanıcının arayüz dili, yazma-anında ilgili satıra kaydedilir
(`request.source_lang`, `response.source_lang`). Eski satırlar `tr` varsayar.

**Edge function `translate`** (verify_jwt açık):
- Girdi: `{ text, source_lang, target_lang }`.
- Akış: `source_lang == target_lang` ise no-op (client zaten çağırmaz). Önce önbellek
  (service-role) kontrolü → varsa döndür. Yoksa Claude API ile çevir → önbelleğe yaz →
  döndür.
- Koruma: en büyük metin boyutu sınırı; boş/aynı-dil kısa devre; hata → net mesaj
  (üst-düzey try/catch, CORS başlıkları her yanıtta).

**Önbellek tablosu `content_translation`:**
```
id uuid pk
source_hash text        -- kaynak metnin hash'i (düzenleme → yeni giriş)
source_lang text
target_lang text
translated_text text
created_at timestamptz
unique (source_hash, target_lang)
```
- **Gizlilik:** Hasta içeriği hassas. Tabloya **doğrudan client erişimi yok** (RLS: yalnız
  service-role). Client her zaman edge function üzerinden erişir; function JWT'yi doğrular
  (yalnız kimliği doğrulanmış klinik personeli). Önbellek hash ile anahtarlanır, kaynak
  satırla bağ tutulmaz.

**Okuma-anı hook `useTranslated(text, sourceLang)`** (client):
- `targetLang == sourceLang` veya boş metin → orijinali döndür (çağrı yok).
- Aksi halde edge function'ı çağır; sonuç React Query ile oturum-içi önbelleklenir
  (anahtar: `['translate', hash, targetLang]`).
- Yükleniyor durumunda kısa iskelet/placeholder; hata → orijinali göster + sessiz uyarı.

**Görüntüleme bileşeni `TranslatedText`:**
- Varsayılan: çevrilmiş metin + küçük **"otomatik çeviri"** etiketi.
- **"Orijinali göster"** geçişi ile kaynak metne dönülebilir (tıbbi/hukuki güvenlik).
- Kaynak dil == okuyucu dili ise etiket/gösterge yok (düz metin).

**AI notları:** `suitability_note` + uyarı gerekçeleri kanonik **Türkçe** üretilmeye devam
eder; okuma-anında diğer içerik gibi çevrilir.

**Çevrilmeyen alanlar:** Hasta ad/soyad, telefon, e-posta, sayısal değerler.

### 3.5 Çevrilecek içerik alanları

`request.notes`, `request.past_surgeries`, `request.medications`,
`response.treatment_plan`, `response.reject_reason`,
`ai_evaluation.suitability_note` + uyarı gerekçeleri,
koordinatör/mükerrer notları (`ai_feedback.note`, duplicate `note`).

## 4. Şema Değişiklikleri

- `app_user.language text not null default 'tr'`
- `request.source_lang text not null default 'tr'`
- `response.source_lang text not null default 'tr'`
- `category.name_i18n jsonb`, `subcategory.name_i18n jsonb`, `operation_type.name_i18n jsonb`
- Yeni tablo `content_translation` (§3.4) + RLS (yalnız service-role).

## 5. Aşamalı Teslim Planı (her faz tek başına yayınlanabilir)

1. **Faz 1 — Web i18n (TR+AR+EN) + RTL:** i18next kurulumu, dil seçici,
   `app_user.language`, tüm web ekranlarında string çıkarımı, 3 dil bundle (AR+EN Claude
   toplu), Arapça RTL geçişi.
2. **Faz 2 — Katalog i18n:** `name_i18n jsonb` + seed çeviri + görüntüleme.
3. **Faz 3 — İçerik çeviri altyapısı:** edge function + `content_translation` +
   `source_lang` sütunları + `useTranslated`/`TranslatedText` + hasta bilgisi/not/plan/
   gerekçe alanlarına uygulama. Diller TR↔AR↔EN.
4. **Faz 4 — Mobil i18n + RTL + içerik çevirisi:** aynı desenler Expo tarafında
   (expo-localization + async-storage).
5. **Faz 5 — Diğer diller:** RU + DE + FR bundle + katalog seed (altyapı hazır, düşük emek).
6. **Faz 6 — Doğrulama:** e2e (AR satışçı → TR doktor akışı), RTL görsel tur, çeviri
   önbellek isabeti, maliyet sayacı kontrolü.

## 6. Riskler / Notlar

- **Maliyet:** Okuma-anı + önbellek en düşük maliyetli yaklaşım. Yine de Claude çeviri
  çağrıları için basit bir karakter/çağrı sayacı (izleme) eklenir.
- **Tıbbi sorumluluk:** "otomatik çeviri" etiketi + orijinale erişim zorunlu (§3.4).
- **Kapsam emeği:** ~40 web ekranında string çıkarımı en emek-yoğun ama mekanik kısım;
  fazlara bölünerek her adım denenip yayınlanabilir tutuldu.
- **Önbellek gizliliği:** Çeviriler edge function arkasında; tabloya doğrudan client
  erişimi yok.
- **Kaynak-dil doğruluğu:** Yazarın arayüz dili kaynak kabul edilir (algılamaya güvenmek
  yerine). Kullanıcı dilini değiştirip yazarsa yeni içerik yeni dile göre etiketlenir;
  geçmiş içerik kendi `source_lang`'ında kalır.

## 7. Kapsam Dışı (şimdilik)

- Hasta-yüzlü arayüz yok (hasta uygulaması yok) → hasta dili konusu yok.
- Sesli/gerçek-zamanlı çeviri yok.
- Çeviri düzenleme/onay iş akışı (insan-döngüde) yok; "orijinali göster" yeterli görülür.
