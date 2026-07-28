# Telefon Numarasında Ülke Kodunun Korunması (E.164) — Implementasyon Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `patient.phone` sütununa ülke kodu korunmuş kanonik E.164 değeri yazmak; mükerrer eşleştirmeyi mevcut veritabanı fonksiyonel indeksi üzerinden çalışır tutmak.

**Architecture:** `src/domain/phone.ts` içine üç saf fonksiyon eklenir (`toE164`, `hasExplicitCountryCode`, `isValidPhone`). Mevcut `normalizePhone` imzası ve davranışı hiç değişmez — yalnız yazma yolundan çıkarılıp eşleştirme/karşılaştırma rolünde kalır. Sihirbaz iki satırda yeni fonksiyonlara geçer ve telefon alanının altında kaydedilecek kanonik değeri canlı gösterir. Veritabanı migration'ı ve veri backfill'i yoktur.

**Tech Stack:** TypeScript, React 19, vitest, i18next (6 dil), Supabase (yalnız okuma tarafı — şema değişmiyor).

## Global Constraints

- **Kapsam yalnız web.** `mobile/` dizinine dokunulmaz — talep oluşturma akışı orada yok.
- **Migration yok, backfill yok.** `supabase/migrations/` altına dosya eklenmez, mevcut `patient` satırları güncellenmez.
- **`normalizePhone` değiştirilmez.** İmzası, gövdesi ve mevcut 8 testi olduğu gibi kalır.
- **Varsayılan ülke:** `dialCode: '90'`, `nationalLength: 10` (Türkiye).
- **i18n:** her yeni anahtar altı dilin tamamına eklenir (`tr`, `en`, `ar`, `ru`, `de`, `fr`). `src/i18n/__tests__/keyParity.test.ts` bunu zorunlu kılar.
- **Kod yorumları Türkçe** — deponun mevcut deseni.
- Tasarım dokümanı: `docs/superpowers/specs/2026-07-28-telefon-e164-ulke-kodu-design.md`

---

## Dosya Yapısı

| Dosya | Sorumluluk | İşlem |
|---|---|---|
| `src/domain/phone.ts` | Telefon saf fonksiyonları: normalize (eşleştirme), E.164 (yazma), doğrulama | Değiştir |
| `src/domain/__tests__/phone.test.ts` | Yukarıdakinin birim testleri | Değiştir |
| `src/features/requests/NewRequestWizard.tsx` | Yazma yolu, doğrulama, telefon alanı ipucu | Değiştir |
| `src/i18n/locales/{tr,en,ar,ru,de,fr}/requests.json` | Telefon alanı metinleri | Değiştir (6 dosya) |

---

### Task 1: `toE164` ve `hasExplicitCountryCode`

**Files:**
- Modify: `src/domain/phone.ts`
- Test: `src/domain/__tests__/phone.test.ts`

**Interfaces:**
- Consumes: mevcut `normalizePhone(raw: string): string` (değiştirilmez)
- Produces:
  - `toE164(raw: string): string` — `'+' + rakamlar` veya rakam yoksa `''`
  - `hasExplicitCountryCode(raw: string): boolean`

- [ ] **Step 1: Failing testleri yaz**

`src/domain/__tests__/phone.test.ts` dosyasının **sonuna** ekle (mevcut `describe('normalizePhone', ...)` bloğuna dokunma). Import satırını da güncelle:

```ts
import { normalizePhone, toE164, hasExplicitCountryCode } from '../phone'
```

```ts
describe('toE164', () => {
  it('artı işaretli uluslararası girdiyi biçimlendirmeden arındırır', () => {
    expect(toE164('+966 51 234 5678')).toBe('+966512345678')
  })

  it('00 uluslararası çıkış önekini + karşılığına çevirir', () => {
    expect(toE164('00966512345678')).toBe('+966512345678')
  })

  it('00 kuralı trunk 0 kuralından önce gelir', () => {
    // "00 90 ..." trunk-0 dalına düşerse "+900905..." üretilirdi.
    expect(toE164('00 90 532 111 22 33')).toBe('+905321112233')
  })

  it('baştaki trunk 0 yerine varsayılan ülke kodunu koyar', () => {
    expect(toE164('0532 111 22 33')).toBe('+905321112233')
  })

  it('artısız ama varsayılan ülke koduyla başlayan uzun girdiyi uluslararası sayar', () => {
    expect(toE164('905321112233')).toBe('+905321112233')
  })

  it('çıplak ulusal numaraya varsayılan ülke kodunu ekler', () => {
    expect(toE164('532 111 22 33')).toBe('+905321112233')
  })

  it('parantezli ulusal girdiyi de çevirir', () => {
    expect(toE164('(0532) 111 22 33')).toBe('+905321112233')
  })

  it('Rus numarasını ülke koduyla korur', () => {
    expect(toE164('+7 912 345 67 89')).toBe('+79123456789')
  })

  it('rakam içermeyen girdi için boş döner', () => {
    expect(toE164('abc-def')).toBe('')
  })

  it('boş girdi için boş döner', () => {
    expect(toE164('')).toBe('')
  })

  it('yalnız boşluktan oluşan girdi için boş döner', () => {
    expect(toE164('   ')).toBe('')
  })
})

describe('hasExplicitCountryCode', () => {
  it('artı işaretli girdi için true döner', () => {
    expect(hasExplicitCountryCode('+966512345678')).toBe(true)
  })

  it('00 önekli girdi için true döner', () => {
    expect(hasExplicitCountryCode('00966512345678')).toBe(true)
  })

  it('artısız ama varsayılan ülke koduyla başlayan uzun girdi için true döner', () => {
    // Doğru sonuca ulaşıyor; arayüzde "varsayıldı" uyarısı GÖSTERİLMEMELİ.
    expect(hasExplicitCountryCode('905321112233')).toBe(true)
  })

  it('çıplak ulusal numara için false döner', () => {
    expect(hasExplicitCountryCode('5321112233')).toBe(false)
  })

  it('trunk 0 ile başlayan ulusal numara için false döner', () => {
    expect(hasExplicitCountryCode('0532 111 22 33')).toBe(false)
  })

  it('boş girdi için false döner', () => {
    expect(hasExplicitCountryCode('')).toBe(false)
  })
})
```

- [ ] **Step 2: Testleri çalıştırıp kırmızı olduğunu doğrula**

Run: `npx vitest run src/domain/__tests__/phone.test.ts`
Expected: FAIL — `toE164` ve `hasExplicitCountryCode` export edilmediği için import hatası.

- [ ] **Step 3: Implementasyonu yaz**

`src/domain/phone.ts` dosyasının **başındaki mevcut JSDoc bloğunun üstüne** tasarım notunu, dosyanın sonuna da iki fonksiyonu ekle. `normalizePhone` gövdesine dokunma.

Dosyanın başına:

```ts
/**
 * Telefon yardımcıları.
 *
 * TASARIM NOTU — `normalizePhone` neden hâlâ son 10 haneyi alıyor?
 * Veritabanındaki `normalize_phone` (0020_duplicate_detection.sql) de aynı
 * son-10 kuralında ve `patient_phone_norm_idx` fonksiyonel indeksi bunun
 * üzerine kurulu. Bu kural, ülke kodu OLMADAN kaydedilmiş eski satırlarla
 * (`5321112233`) E.164 olarak kaydedilen yeni satırların (`+905321112233`)
 * birbirini bulmasını sağlayan tek köprü — ülke kodu duyarlı bir normalize'a
 * geçilirse eski↔yeni eşleşmesi tamamen kırılır. Bu yüzden `normalizePhone`
 * DEĞİŞTİRİLMEMELİ; yalnız eşleştirme/karşılaştırma için kullanılır.
 * `patient.phone`'a yazılan değeri `toE164()` üretir.
 *
 * Mevcut satırlarda ülke kodu geri getirilemez; `+90` varsayan bir backfill
 * bilerek yapılmadı (yanlış ülke kodu, "bilinmiyor"dan daha kötüdür).
 *
 * Ayrıntı: docs/superpowers/specs/2026-07-28-telefon-e164-ulke-kodu-design.md
 */

/** Ülke kodu yazılmamış girdiler bu ülkenin numarası sayılır. */
const DEFAULT_COUNTRY = { dialCode: '90', nationalLength: 10 } as const
```

Dosyanın sonuna:

```ts
/**
 * Girdiyi kanonik E.164'e çevirir: `patient.phone`'a YAZILAN değer budur.
 * Kurallar sırayla denenir; sıralama tasarımın parçasıdır (aşağıdaki yorumlar).
 * Rakam içermeyen girdide boş döner.
 */
export function toE164(raw: string): string {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  // 1) "+..." → ülke kodu açıkça verilmiş; rakamlara olduğu gibi güvenilir.
  if (trimmed.startsWith('+')) return `+${digits}`
  // 2) "00..." uluslararası çıkış öneki. Trunk "0" kuralından ÖNCE bakılmalı,
  //    yoksa "00966..." girdisi "+900966..." olurdu.
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  // 3) Baştaki trunk "0" → ulusal biçim; "0" atılıp varsayılan kod eklenir.
  if (digits.startsWith('0')) return `+${DEFAULT_COUNTRY.dialCode}${digits.slice(1)}`
  // 4) Varsayılan ülke koduyla başlıyor VE ulusal uzunluktan uzunsa zaten
  //    uluslararası ("905321112233"). TR'de "90" ile başlayan alan kodu veya
  //    mobil öneki yok, bu yüzden kural yanlış tetiklenemez.
  if (digits.startsWith(DEFAULT_COUNTRY.dialCode) && digits.length > DEFAULT_COUNTRY.nationalLength) {
    return `+${digits}`
  }
  // 5) Ulusal biçim.
  return `+${DEFAULT_COUNTRY.dialCode}${digits}`
}

/**
 * Girdi ülke kodunu KENDİSİ belirliyor mu? (toE164'ün 1, 2 ve 4 numaralı
 * kuralları). Arayüzdeki "varsayıldı" uyarısı ve doğrulama dalı buna bakar.
 */
export function hasExplicitCountryCode(raw: string): boolean {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return false
  if (trimmed.startsWith('+')) return true
  if (digits.startsWith('00')) return true
  return digits.startsWith(DEFAULT_COUNTRY.dialCode) && digits.length > DEFAULT_COUNTRY.nationalLength
}
```

- [ ] **Step 4: Testleri çalıştırıp yeşil olduğunu doğrula**

Run: `npx vitest run src/domain/__tests__/phone.test.ts`
Expected: PASS — 8 mevcut + 11 `toE164` + 6 `hasExplicitCountryCode` = 25 test.

- [ ] **Step 5: Commit**

```bash
git add src/domain/phone.ts src/domain/__tests__/phone.test.ts
git commit -m "feat(telefon): toE164 ve hasExplicitCountryCode — ülke kodunu koruyan kanonikleştirme"
```

---

### Task 2: `isValidPhone` ve normalize-uyum regresyon testi

**Files:**
- Modify: `src/domain/phone.ts`
- Test: `src/domain/__tests__/phone.test.ts`

**Interfaces:**
- Consumes: `toE164(raw: string): string`, `hasExplicitCountryCode(raw: string): boolean`, `normalizePhone(raw: string): string`
- Produces: `isValidPhone(raw: string): boolean`

- [ ] **Step 1: Failing testleri yaz**

Import satırını güncelle:

```ts
import { normalizePhone, toE164, hasExplicitCountryCode, isValidPhone } from '../phone'
```

Dosyanın sonuna ekle:

```ts
describe('isValidPhone', () => {
  it('10 haneli TR ulusal numarayı kabul eder', () => {
    expect(isValidPhone('5321112233')).toBe(true)
  })

  it('trunk 0 ile yazılmış TR numarasını kabul eder', () => {
    expect(isValidPhone('0532 111 22 33')).toBe(true)
  })

  it('ülke kodu varsayıldığında eksik haneli girdiyi eler', () => {
    // toE164 başa "90" eklediği için toplam 10 haneye çıkar; tek bir
    // "en az 10 hane" kuralı bu girdiyi yanlışlıkla geçerli sayardı.
    expect(isValidPhone('12345678')).toBe(false)
  })

  it('kısa girdiyi eler', () => {
    expect(isValidPhone('532111')).toBe(false)
  })

  it('ülke kodu açık verilmiş kısa ulusal numaralı ülkeyi kabul eder', () => {
    expect(isValidPhone('+45 12345678')).toBe(true)
  })

  it('Suudi numarasını kabul eder', () => {
    expect(isValidPhone('+966 51 234 5678')).toBe(true)
  })

  it('artısız ama ülke kodlu uzun girdiyi kabul eder', () => {
    expect(isValidPhone('905321112233')).toBe(true)
  })

  it('E.164 üst sınırını (15 hane) aşan girdiyi eler', () => {
    expect(isValidPhone('+1234567890123456')).toBe(false)
  })

  it('boş girdiyi eler', () => {
    expect(isValidPhone('')).toBe(false)
  })
})

describe('toE164 ↔ normalizePhone uyumu (mükerrer eşleştirme regresyonu)', () => {
  // KİLİT VARSAYIM: E.164'e geçiş, DB'deki normalize_phone (son 10 hane)
  // eşleştirmesini bozmamalı. toE164 yalnız başa ekleme yaptığı için 10+
  // haneli her girdide son 10 hane aynı kalır. Bu test o varsayımı sabitler;
  // kırılırsa eski kayıtlar yeni kayıtlarla eşleşmiyor demektir.
  const inputs = [
    '+90 532 111 2233',
    '0532-111-22-33',
    '905321112233',
    '5321112233',
    '(0532) 111 22 33',
    '+966 51 234 5678',
    '00966512345678',
  ]

  it.each(inputs)('normalize sonucu %s için değişmez', (input) => {
    expect(normalizePhone(toE164(input))).toBe(normalizePhone(input))
  })
})
```

- [ ] **Step 2: Testleri çalıştırıp kırmızı olduğunu doğrula**

Run: `npx vitest run src/domain/__tests__/phone.test.ts`
Expected: FAIL — `isValidPhone` export edilmediği için import hatası.

- [ ] **Step 3: Implementasyonu yaz**

`src/domain/phone.ts` sonuna ekle:

```ts
/**
 * Sihirbazın "telefon tamam mı?" kapısı.
 *
 * Tek bir "en az 10 hane" kuralı kullanılamaz: toE164 varsayılan ülke kodunu
 * başa eklediği için bugün elenen 8 haneli girdiler geçerli sayılırdı. Bu
 * yüzden iki dal var — ülke kodu açık verilmişse E.164 sınırları, varsayılan
 * uygulanmışsa ulusal kısmın tam uzunlukta olması aranır.
 */
export function isValidPhone(raw: string): boolean {
  const e164 = toE164(raw)
  if (!e164) return false
  const digits = e164.slice(1)
  if (hasExplicitCountryCode(raw)) return digits.length >= 8 && digits.length <= 15
  return digits.length === DEFAULT_COUNTRY.dialCode.length + DEFAULT_COUNTRY.nationalLength
}
```

- [ ] **Step 4: Testleri çalıştırıp yeşil olduğunu doğrula**

Run: `npx vitest run src/domain/__tests__/phone.test.ts`
Expected: PASS — 25 önceki + 9 `isValidPhone` + 7 regresyon = 41 test.

- [ ] **Step 5: Commit**

```bash
git add src/domain/phone.ts src/domain/__tests__/phone.test.ts
git commit -m "feat(telefon): isValidPhone + normalize uyum regresyon testi"
```

---

### Task 3: Yazma yolunu E.164'e geçir

**Files:**
- Modify: `src/features/requests/NewRequestWizard.tsx:14` (import)
- Modify: `src/features/requests/NewRequestWizard.tsx:161-163` (RPC yorumu)
- Modify: `src/features/requests/NewRequestWizard.tsx:197` (doğrulama)
- Modify: `src/features/requests/NewRequestWizard.tsx:275` (insert değeri)

**Interfaces:**
- Consumes: `toE164`, `isValidPhone`, `normalizePhone` — `src/domain/phone.ts`
- Produces: `patient.phone` artık `+905321112233` biçiminde yazılır. `src/features/requests/useRequests.ts:56` değeri olduğu gibi geçirdiği için orada değişiklik yok.

- [ ] **Step 1: Import satırını güncelle**

`src/features/requests/NewRequestWizard.tsx:14`:

```ts
import { normalizePhone, toE164, isValidPhone } from '../../domain/phone'
```

- [ ] **Step 2: Mükerrer arama RPC'sine neden ham telefon gittiğini yorumla**

`src/features/requests/NewRequestWizard.tsx` içindeki `supabase.rpc('find_patient_matches', ...)` çağrısının (≈161-163) hemen üstüne ekle:

```ts
      // RPC'ye HAM telefon gider (toE164 değil): DB tarafındaki normalize_phone
      // zaten son 10 haneyi alıyor ve toE164 yalnız başa ekleme yaptığı için
      // 10+ haneli girdilerde iki değerin son 10 hanesi aynı. Çevirmek fayda
      // sağlamaz, buna karşılık yazarken oluşan yarım girdileri ("053" →
      // "+9053") bozardı.
```

- [ ] **Step 3: Doğrulamayı `isValidPhone`'a geçir**

`src/features/requests/NewRequestWizard.tsx:197` satırını değiştir:

```ts
  const phoneOk = isValidPhone(phone)
```

`normalizePhone(phone).length < 7` guard'ı (≈160) **olduğu gibi kalır** — "hâlâ yazılıyor" kapısı ve DB ile aynı normalize mantığını kullanıyor.

- [ ] **Step 4: Insert değerini `toE164`'e geçir**

`src/features/requests/NewRequestWizard.tsx:275` satırını değiştir:

```ts
        patient: { first_name: first, last_name: last, phone: toE164(phone) },
```

- [ ] **Step 5: Tip kontrolü ve testleri çalıştır**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx vitest run`
Expected: tsc çıktısız (hata yok), vitest tüm suite PASS.

`normalizePhone` hâlâ 160. satırda kullanıldığı için "unused import" uyarısı çıkmamalı. Lint için:

Run: `npm run lint`
Expected: hata yok.

- [ ] **Step 6: Commit**

```bash
git add src/features/requests/NewRequestWizard.tsx
git commit -m "fix(talep): hasta telefonu E.164 olarak kaydedilsin — ülke kodu korunur"
```

---

### Task 4: Telefon alanı ipucu ve altı dilli metinler

**Files:**
- Modify: `src/features/requests/NewRequestWizard.tsx:14` (import), `:197` civarı (ipucu hesabı), `:400-402` (alan)
- Modify: `src/i18n/locales/tr/requests.json`
- Modify: `src/i18n/locales/en/requests.json`
- Modify: `src/i18n/locales/ar/requests.json`
- Modify: `src/i18n/locales/ru/requests.json`
- Modify: `src/i18n/locales/de/requests.json`
- Modify: `src/i18n/locales/fr/requests.json`
- Test: `src/i18n/__tests__/keyParity.test.ts` (yeni test yazılmaz; mevcut test anahtar eşliğini doğrular)

**Interfaces:**
- Consumes: `toE164`, `hasExplicitCountryCode` — `src/domain/phone.ts`; `Field` bileşeninin mevcut `hint?: string` prop'u (`src/components/ui/Field.tsx`)
- Produces: kullanıcıya görünür metinler; başka modül tüketmez.

- [ ] **Step 1: Altı dile de yeni anahtarları ekle**

Her dosyada `"phonePlaceholder"` satırını **değiştir** ve hemen ardına `"phoneHint"` nesnesini **ekle**. Anahtar yapısı altı dilde birebir aynı olmalı, yoksa `keyParity` testi kırılır.

`src/i18n/locales/tr/requests.json`:

```json
    "phonePlaceholder": "+90 5XX XXX XX XX",
    "phoneHint": {
      "saved": "Kaydedilecek: {{value}}",
      "assumedCountry": "Ülke kodu girilmedi, +90 (Türkiye) varsayıldı"
    },
```

`src/i18n/locales/en/requests.json`:

```json
    "phonePlaceholder": "+90 5XX XXX XX XX",
    "phoneHint": {
      "saved": "Will be saved as: {{value}}",
      "assumedCountry": "No country code entered, +90 (Turkey) assumed"
    },
```

`src/i18n/locales/ar/requests.json`:

```json
    "phonePlaceholder": "+90 5XX XXX XX XX",
    "phoneHint": {
      "saved": "سيتم الحفظ كالتالي: {{value}}",
      "assumedCountry": "لم يتم إدخال رمز الدولة، تم افتراض +90 (تركيا)"
    },
```

`src/i18n/locales/ru/requests.json`:

```json
    "phonePlaceholder": "+90 5XX XXX XX XX",
    "phoneHint": {
      "saved": "Будет сохранено: {{value}}",
      "assumedCountry": "Код страны не указан, предполагается +90 (Турция)"
    },
```

`src/i18n/locales/de/requests.json`:

```json
    "phonePlaceholder": "+90 5XX XXX XX XX",
    "phoneHint": {
      "saved": "Wird gespeichert als: {{value}}",
      "assumedCountry": "Keine Landesvorwahl eingegeben, +90 (Türkei) angenommen"
    },
```

`src/i18n/locales/fr/requests.json`:

```json
    "phonePlaceholder": "+90 5XX XXX XX XX",
    "phoneHint": {
      "saved": "Sera enregistré : {{value}}",
      "assumedCountry": "Aucun indicatif pays saisi, +90 (Turquie) supposé"
    },
```

- [ ] **Step 2: Anahtar eşliğini doğrula**

Run: `npx vitest run src/i18n/__tests__/keyParity.test.ts`
Expected: PASS. Bir dil atlanmışsa bu test eksik anahtarı adıyla raporlar.

- [ ] **Step 3: Import satırını genişlet**

`src/features/requests/NewRequestWizard.tsx:14`:

```ts
import { normalizePhone, toE164, isValidPhone, hasExplicitCountryCode } from '../../domain/phone'
```

- [ ] **Step 4: İpucu metnini hesapla**

`src/features/requests/NewRequestWizard.tsx` içinde `const phoneOk = isValidPhone(phone)` satırının hemen altına ekle:

```ts
  // Kaydedilecek kanonik değeri kullanıcıya göster: ülke kodu yazılmadıysa
  // varsayımın SESSİZ kalmaması gerekiyor (Suudi numarasını "+90..." diye
  // kaydetmemenin tek güvencesi bu satır).
  const phoneE164 = toE164(phone)
  // \u2068/\u2069 (first-strong isolate): Arapça gibi RTL arayüzlerde
  // "+905321112233" değerinin baştaki "+" ile birlikte doğru yönde kalmasını
  // sağlar; olmazsa artı işareti numaranın diğer ucuna kayar. Kaçış dizisiyle
  // yazılır — bu karakterler görünmezdir, düz yapıştırmada kaybolur.
  const phoneHint = phoneE164
    ? [
        t('newRequest.phoneHint.saved', { value: `\u2068${phoneE164}\u2069` }),
        hasExplicitCountryCode(phone) ? null : t('newRequest.phoneHint.assumedCountry'),
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined
```

- [ ] **Step 5: İpucunu alana bağla**

`src/features/requests/NewRequestWizard.tsx:400-402` — telefon `Field`'ını değiştir:

```tsx
            <Field label={t('newRequest.phoneLabel')} hint={phoneHint}>
              <Input type="tel" placeholder={t('newRequest.phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
```

- [ ] **Step 6: Tip kontrolü, lint ve tüm testleri çalıştır**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint && npx vitest run`
Expected: üçü de temiz.

- [ ] **Step 7: Tarayıcıda doğrula**

Dev sunucusunu başlat, `/requests/new` sayfasını aç (`src/App.tsx:56`; rota `agent`/`sales` rolüyle korunuyor) ve telefon alanına sırayla şunları yazıp alanın altındaki ipucunu gözle:

| Yazılan | Beklenen ipucu |
|---|---|
| (boş) | ipucu yok |
| `0532 111 22 33` | `Kaydedilecek: +905321112233 · Ülke kodu girilmedi, +90 (Türkiye) varsayıldı` |
| `+966 51 234 5678` | `Kaydedilecek: +966512345678` (varsayım uyarısı YOK) |

Ardından dili Arapça'ya çevirip aynı alana `+966512345678` yaz; numaranın `+` işaretiyle birlikte bozulmadan göründüğünü doğrula.

- [ ] **Step 8: Commit**

```bash
git add src/features/requests/NewRequestWizard.tsx src/i18n/locales/*/requests.json
git commit -m "feat(talep): telefon alanında kaydedilecek E.164 değerini canlı göster (6 dil)"
```

---

## Kapsam Dışı — Bilerek Yapılmayanlar

Bu maddeler tasarımda tartışılıp elendi; plana dahil **değil**:

- **Veritabanı migration'ı.** `normalize_phone` ve `patient_phone_norm_idx` değişmez — son-10 kuralı eski↔yeni satır eşleşmesinin tek köprüsü.
- **Mevcut satırların backfill'i.** Ülke kodu geri getirilemez; `+90` varsaymak veriyi "bilinmiyor"dan "yanlış ama kesin görünüyor"a çevirirdi.
- **Ülke kodu select'i / giriş maskesi.** "Yapıştır ve doldur" akışını ve taslak şemasını bozar; maske tek ülkenin biçimini kodlar ve RTL'de kötü davranır.
- **Mobil uygulama.** Talep oluşturma akışı `mobile/` altında yok.
