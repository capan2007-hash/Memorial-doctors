# KVKK Aydınlatma Metni — Altı Dilli, Taslaktan Çıkarma — Tasarım

**Tarih:** 2026-07-28 · **Durum:** Onaylandı (kullanıcı) · **Kapsam:** Yalnız Web

## 1. Amaç

`/aydinlatma` sayfası şu an **TASLAK**: bannerı ve `[Klinik unvanı]`, `[Adres]`,
`[Süre detayları]`, `[iletişim kanalı]` yer tutucuları var
(`src/pages/Aydinlatma.tsx`). Bu sayfa iOS yayınının **gizlilik politikası URL'i**
olarak verilecek; Apple reviewer okuyabilir, yer tutuculu metin ret riski taşır
(`docs/superpowers/ios-testflight-hazirlik.md` §4).

İki hedef:

1. **iOS blokajını açmak** — geçerli, yer tutucusuz bir gizlilik politikası sayfası.
2. **Metni hastanın okuyabildiği dilde sunmak** — uygulama 6 dilli ve hasta kitlesi
   ağırlıkla yurt dışı (Arapça/Rusça); onam metninin yalnız Türkçe olması pratik
   olarak "hasta metni okudu" iddiasını dayanaksız bırakır.

**Hedef olmayan:** hastanın kendi onamını vermesi. Onam kutusunu bugün satışçı
işaretliyor ve bu tasarım onu değiştirmiyor (§9.1).

## 2. Onaylanan Kilit Kararlar

| Karar | Seçim |
|---|---|
| Veri sorumlusu modeli | **Tek klinik, statik metin** (çok kiracılı parametrik metin değil) |
| Metin nerede yaşıyor | **Dil başına içerik modülü** (i18n JSON namespace'i değil, DB tablosu değil) |
| Dil kapsamı | **Altı dilin tamamı** (tr, ar, en, ru, de, fr) |
| Çeviri yöntemi | **Sabit, danışman onaylı metin** — `i18n-content` AI çeviri altyapısı hukuki metinde KULLANILMAZ |
| Paylaşım mekanizması | **Linki kopyala** butonu (WhatsApp derin linki kapsam dışı) |
| Telefon modeli | **Dokunulmuyor** (§9.2'de ayrı iş) |
| TASLAK bannerı | **Veriye bağlı otomatik** — elle kaldırılmaz |

### Neden içerik modülü, neden i18n JSON değil

Hukuki metnin gerçek okuyucusu KVKK danışmanı; okuyup düzelteceği şey prose, JSON
string'i değil. Uzun paragraflar JSON içinde kaçış karakterleriyle okunmaz hale
gelir ve diff'ler değersizleşir. Karşılığında `keyParity.test.ts` güvenlik ağının
dışına çıkılıyor — bunu §7'deki yapısal test telafi eder.

### Neden DB tablosu değil

Deploy'suz metin güncellemesi ve doğal sürüm arşivi cazip, ama yeni tablo + public
read RLS + admin editör ekranı demek. Yılda bir değişecek bir metin için ağır.
Sürümleme ihtiyacı §6'daki `version` sabiti + `request.consent_text_version` ile
karşılanıyor.

## 3. Dosya yapısı

```
src/pages/legal/
  types.ts              LegalDocument / LegalSection tipleri + SECTION_IDS
  clinicIdentity.ts     klinik kimlik sabitleri + IDENTITY_COMPLETE
  retention.ts          saklama süresi sabitleri
  aydinlatma.tr.ts      \
  aydinlatma.en.ts       |
  aydinlatma.ar.ts       |  altı içerik modülü
  aydinlatma.ru.ts       |
  aydinlatma.de.ts       |
  aydinlatma.fr.ts      /
  index.ts              dil → doküman haritası + getLegalDocument(lang)
  __tests__/legalDocuments.test.ts
  __tests__/retention.test.ts
src/pages/Aydinlatma.tsx  render + dil seçici + ?lang= desteği
```

Her içerik modülü **fonksiyon** dışa açar:

```ts
export const aydinlatmaTr = (identity: ClinicIdentity, retention: Retention): LegalDocument => ({ ... })
```

Klinik unvanı/adresi ve saklama günleri altı dosyada tekrar etmez, tek kaynaktan
enjekte edilir. Adres değişince tek yer güncellenir, altı dil birlikte doğru kalır.

`getLegalDocument(lang)` desteklenmeyen/bilinmeyen dilde **`tr`**'ye düşer: veri
sorumlusu Türkiye'de, hukuki dayanak KVKK, asıl metin Türkçe.

## 4. Doküman şeması

```ts
export const SECTION_IDS = ['controller', 'data', 'purpose', 'legalBasis', 'transfer', 'retention', 'rights'] as const
export type SectionId = (typeof SECTION_IDS)[number]

export type LegalSection = {
  id: SectionId
  heading: string
  paragraphs: string[]
  emphasis?: boolean      // yurt dışı aktarım bölümü vurgulu çerçevede
}

export type LegalDocument = {
  version: string         // ör. '2026-07-28' — ALTI DİLDE AYNI
  title: string
  subtitle: string
  updatedLabel: string    // "Son güncelleme" karşılığı
  draftWarning: string    // TASLAK bannerı metni (o dilde)
  shareMessage: string    // paylaşım şablonu (o dilde), `{{link}}` yer tutucusu içerir — §5.2
  sections: LegalSection[]
}
```

`version` dokümanın tamamına ait, dil başına değil — altı modülde eşit olmak
zorunda, test bunu doğrular. Metin her değiştiğinde altı modülde birlikte artar.

### 4.1 Yeni bölüm: `legalBasis`

Mevcut taslakta **toplama yöntemi ve hukuki sebep** hiç yok. KVKK m.10 aydınlatma
yükümlülüğü bunları sayıyor; ayrıca sağlık verisi m.6 anlamında **özel nitelikli
veri** ve dayanağı açık rıza. Bu bölüm olmadan metin eksik.

İçerik yönü: verilerin klinik personeli tarafından hastanın başvuru kanalı
(WhatsApp, telefon, yüz yüze) üzerinden kaydedildiği ve işlemenin dayanağının
KVKK m.6 açık rıza olduğu. **İlk taslak sistemin gerçek davranışına göre yazılır,
nihai metin danışman onayına tabidir.**

## 5. Sayfa davranışı

### 5.1 Dil erişimi

- Sayfaya `LanguageSwitcher` eklenir (sağ üst). Bileşen kendi kendine yeterli;
  anonim kullanıcıda `appUser` null olduğu için yalnız i18next'i değiştirir,
  sunucuya yazmaz — public sayfada doğru davranış.
- `aria-label="Dil seçimi"` sabit Türkçe — `t()`'ye çevrilir.
- **`?lang=xx` parametresi** desteklenir: paylaşılan link hastanın dilinde açılır.
  Geçersiz değer yok sayılır, mevcut algılama devreye girer.
- RTL zaten çalışıyor: `applyDir` `languageChanged`'e bağlı (`src/i18n/index.ts:83`).
  Sayfa mantıksal Tailwind sınıfları kullanır (`docs/superpowers/rtl-conventions.md`).

### 5.2 Paylaşım (onam kartı)

`NewRequestWizard` onam kartına bir satır eklenir:

- **Dil seçici** — varsayılan satışçının aktif arayüz dili.
- **"Linki kopyala" butonu** — panoya kopyalanan şey, seçilen dildeki `shareMessage`
  şablonunun `{{link}}` yer tutucusuna `<origin>/aydinlatma?lang=<seçilen>` konularak
  elde edilen **tek parça metindir** (yalnız URL değil). Satışçı kendi WhatsApp'ına
  yapıştırır. Kopyalama sonrası kısa bir onay göstergesi (toast) verilir.

WhatsApp derin linki (`wa.me`) **kapsam dışı**: tam uluslararası numara gerektiriyor,
mevcut telefon modeli ülke kodunu saklamıyor (§9.2).

## 6. Klinik kimlik ve TASLAK bannerı

```ts
// clinicIdentity.ts
export type ClinicIdentity = { legalName: string; address: string; email: string; phone: string; verbis: string }
export const CLINIC_IDENTITY: ClinicIdentity = { legalName: '', address: '', email: '', phone: '', verbis: '' }
export const IDENTITY_COMPLETE = Boolean(CLINIC_IDENTITY.legalName && CLINIC_IDENTITY.address && CLINIC_IDENTITY.email)
```

- `IDENTITY_COMPLETE === false` → sayfa `draftWarning` bannerını gösterir (aktif dilde).
- `true` → banner kaybolur.

Banner artık elle kaldırılan bir şey değil, **veri girildiğinde kendi düşen** bir şey.
Yer tutucu kalıntısıyla yayına çıkmak yapısal olarak engellenmiş olur.

`phone` ve `verbis` opsiyonel. İçerik modülleri bunları koşullu ekler: değer boşsa
ilgili cümle `paragraphs` dizisine hiç konmaz — boş parantez, "—" veya yer tutucu
bırakılmaz. `legalName`/`address`/`email` ise `IDENTITY_COMPLETE` tarafından zorunlu
kılındığı için koşulsuz kullanılır.

### 6.1 Bekleyen girdi — KULLANICIDAN

Bu dört veri gelmeden sayfa TASLAK modunda kalır ve yayına çıkmaz:

1. Klinik/şirketin **tam ticaret unvanı**
2. **Açık adres** (tebligat adresi)
3. **Başvuru e-postası** (KVKK m.11 talepleri)
4. Opsiyonel: telefon, **VERBİS kayıt numarası**

Altyapı ve altı dilin metni bu veriler olmadan tamamlanabilir.

## 7. Saklama süreleri

```ts
// retention.ts
export const RETENTION = { photoDays: 60, opBufferDays: 30 } as const
```

Kaynak: `tenant.photo_retention_days` (varsayılan 60) ve `photo_op_buffer_days`
(varsayılan 30) — `supabase/migrations/0016_photo_lifecycle.sql`. Public sayfa
oturumsuz olduğu için DB'den okunamaz; tek-klinik kararıyla sabit doğru çözüm.

`retention.test.ts` değerlerin 60/30 olduğunu doğrular — biri `tenant`
varsayılanını değiştirirse test kırılır ve hukuki metnin de güncellenmesi
gerektiğini söyler.

## 8. Onam kaydı

**Migration 0060:**

```sql
alter table request add column consent_text_version text;
alter table request add column consent_lang text;
```

- `useCreateRequest`, onam verildiğinde aktif dokümanın `version`'ını ve §5.2'de
  seçilen dili yazar.
- Mevcut satırlar `null` kalır — geriye dönük bilinemez, kabul edilir.
- Arayüzde gösterim **kapsam dışı**; kayıt yeterli, ihtiyaç doğunca eklenir.
- Mevcut `consent_at` / `consent_channel` / `consented_by` kolonları
  (`0022_consent_patient_rls.sql`) olduğu gibi kalır.

## 9. Kapsam dışı / sonraki işler

### 9.1 Hastanın kendi onamı (gerçek KVKK çözümü)

Bu tasarımdan sonra da onam kutusunu **satışçı** işaretliyor. Altı dilli metin,
hastanın okuyabileceği bir metin olduğunu sağlar; hastanın onam verdiğini
kanıtlamaz. Sağlık verisi özel nitelikli veri olduğu için açık rızanın veri
sahibinden gelmesi gerekir.

Gerçek çözüm: talep başına tek kullanımlık token'lı public link → hasta kendi
telefonunda kendi dilinde metni okur, kutuyu **kendi** işaretler, sistem zaman
damgası + dil + sürümle kaydeder. Yeni tablo, public edge function, token yaşam
döngüsü ve hasta tarafı ekran demek — **kendi spec'ini hak eden bağımsız özellik.**
iOS yayınını buna bağlamamak için bilinçli olarak ayrıldı.

Bu tasarımın katkısı: `consent_lang` + `consent_text_version` kayıtları o iş
geldiğinde zaten yerinde olur.

### 9.2 Telefon ülke kodu sorunu

`src/domain/phone.ts:8` `normalizePhone()` numaranın son 10 hanesini tutup ülke
kodunu atıyor; `NewRequestWizard.tsx:275` bu kırpılmış hâli veritabanına yazıyor.
Oysa `patient_phone_norm_idx on patient (normalize_phone(phone))`
(`0020_duplicate_detection.sql:16`) fonksiyonel indeksi, `phone` kolonunda **ham**
numaranın durmasını bekliyor. Sonuçlar: yurt dışı numaraları arama/WhatsApp için
kullanılamaz hale geliyor; farklı ülkelerden son 10 hanesi aynı iki hasta mükerrer
tespitinde çakışıyor.

Bu turda **dokunulmuyor** (kullanıcı kararı) — ayrı iş olarak açıldı.

### 9.3 Diğer

- Mobil: onam akışı ve talep oluşturma yok, hiç dokunulmuyor.
- `patient.language` alanı: tekrar gelen hastada dili hatırlamak faydalı olurdu,
  şimdilik YAGNI.
- QR kod paylaşımı (yüz yüze hasta): yeni bağımlılık, dışarıda.

## 10. Test planı

`src/pages/legal/__tests__/legalDocuments.test.ts`:

- Altı dilin tamamı `getLegalDocument()` ile çözülüyor.
- Altı dokümanın `version`'ı **eşit**.
- Altı dokümanda bölüm `id`'leri ve **sırası** `SECTION_IDS` ile aynı.
- Hiçbir bölümde boş `heading` veya boş/boş-string paragraf yok.
- `IDENTITY_COMPLETE === true` iken hiçbir paragrafta `[` veya `]` yok
  (yer tutucu kalıntısı koruması).
- Desteklenmeyen dil (`'xx'`) → `tr` dokümanı döner.

`src/pages/legal/__tests__/retention.test.ts`: `RETENTION` değerleri 60/30.

Mevcut `dir.test.ts` RTL sözleşmesini zaten koruyor. E2E **kapsam dışı** (mevcut
e2e paketi CI'da çalışmıyor).

## 11. Yan etki

`docs/superpowers/ios-testflight-hazirlik.md` §4 güncellenir: gizlilik politikası
URL'i altı dilde hazır; kalan tek koşul §6.1'deki klinik kimlik verisi.

## 12. Kabul kriterleri

1. `/aydinlatma` altı dilde tam metin gösteriyor; Arapça'da RTL doğru.
2. `?lang=ar` linki doğrudan Arapça açıyor.
3. Klinik kimlik verisi boşken TASLAK bannerı görünüyor; doldurulduğunda kayboluyor
   ve metinde hiçbir yer tutucu kalmıyor.
4. Onam kartındaki "Linki kopyala" seçilen dildeki linki panoya kopyalıyor.
5. Talep oluşturulduğunda `consent_text_version` ve `consent_lang` yazılıyor.
6. `npm test` ve `npx tsc -b --noEmit` temiz; yeni testler geçiyor.
