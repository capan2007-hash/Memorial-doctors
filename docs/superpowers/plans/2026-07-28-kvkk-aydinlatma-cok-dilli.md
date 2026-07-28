# Altı Dilli KVKK Aydınlatma Metni — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/aydinlatma` sayfasını TASLAK durumundan çıkarıp altı dilde tam metin sunan, paylaşılabilir ve onam kaydına sürüm/dil yazan bir gizlilik politikası sayfasına dönüştürmek — iOS yayın blokajını açmak.

**Architecture:** Hukuki metin, dil başına bir TypeScript içerik modülünde `(identity, retention) => LegalDocument` fonksiyonu olarak yaşar; klinik kimlik bilgileri ve saklama süreleri tek kaynaktan enjekte edilir. Sayfa aktif dile (veya `?lang=` parametresine) göre modülü seçer. TASLAK bannerı `IDENTITY_COMPLETE` sabitine bağlıdır — elle kaldırılmaz, veri girildiğinde düşer.

**Tech Stack:** React 19 · TypeScript · react-i18next · Tailwind (mantıksal RTL sınıfları) · Vitest · Supabase (migration)

**Spec:** [docs/superpowers/specs/2026-07-28-kvkk-aydinlatma-cok-dilli-design.md](../specs/2026-07-28-kvkk-aydinlatma-cok-dilli-design.md)

## Global Constraints

- **Kapsam yalnız web.** `mobile/` dizinine hiç dokunulmaz — mobilde onam akışı ve talep oluşturma yok.
- **Desteklenen diller:** `tr`, `ar`, `en`, `ru`, `de`, `fr` (`SUPPORTED`, `src/i18n/index.ts`). Fallback dili **`tr`**.
- **Hukuki metin AI ile çevrilmez.** `src/features/i18n-content` (`TranslatedText`, `useTranslated`) bu sayfada ve onam metninde KULLANILMAZ. Metinler sabit ve danışman onaylıdır.
- **Sürüm sabiti:** `LEGAL_VERSION = '2026-07-28'`. Metin her değiştiğinde elle artırılır.
- **RTL:** yalnız mantıksal Tailwind sınıfları (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`/`text-start`/`text-end`). Kural: `docs/superpowers/rtl-conventions.md`.
- **Tasarım token'ları:** `surface-*`, `ink-primary`/`ink-secondary`, `line`, `rounded-control` kullanılır — `slate-*` ham renkleri KULLANILMAZ (mevcut sayfa bunları kullanıyor, bu turda temizlenir; koyu tema tutarlılığı da böylece düzelir).
- **Yer tutucu yasağı:** `IDENTITY_COMPLETE` doğruyken hiçbir paragrafta `[` veya `]` karakteri kalmayacak — test bunu zorlar.
- Her task sonunda `npx tsc -b --noEmit` ve `npm test` temiz olmalı.

### Spec'ten bilinçli sapma

Spec §4 "altı modülün `version`'ı eşit olmalı, test bunu doğrular" diyor. Bunun yerine **tek bir `LEGAL_VERSION` sabiti** kullanılıyor ve test her dokümanın `version`'ının bu sabite eşit olduğunu doğruluyor. Eşitliği tesadüfe bırakmak yerine yapısal olarak imkânsız kılıyor — aynı amaç, daha güçlü garanti.

### Ön-uçuş denetimi kararları (2026-07-28, kullanıcı onaylı)

Plan yürütülmeden önce iki test kusuru düzeltildi:

1. **`IDENTITY_COMPLETE` test edilebilir hale getirildi.** Sabitten türeyen sabit test edilemez (testin kendisi tautoloji olur). Artık saf fonksiyon `isIdentityComplete(id: ClinicIdentity): boolean` var; `IDENTITY_COMPLETE` ondan türüyor. Test fixture'larla gerçek davranışı sınıyor.
2. **`resolveLang` `LEGAL_DOCUMENTS` anahtarlarına bakıyor** (`SUPPORTED`'a değil). Böylece Task 2'de yalnız `tr` haritalıyken fallback testi gerçek bir davranışı sınar; Task 3 haritayı doldurdukça kapsam kendiliğinden genişler.

Üçüncü bulgu **kabul edildi, düzeltilmedi:** Task 3'te beş dilin tam metni plana kopyalanmıyor (~6.000 kelime). Bu bilinçli bir sınırdır, eksik plan değildir — yapı, 7 maddelik çeviri sözleşmesi, çalışan bir örnek ve 9 parite testi teslimi denetler.

### Bekleyen girdi (kullanıcıdan)

`CLINIC_IDENTITY` boş başlar; ticaret unvanı, adres ve başvuru e-postası gelene kadar sayfa TASLAK modunda kalır. **Bu plan bu veriler olmadan sonuna kadar uygulanabilir.**

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `src/pages/legal/types.ts` | `LegalDocument`/`LegalSection`/`SectionId` tipleri, `SECTION_IDS`, `LEGAL_VERSION` |
| `src/pages/legal/clinicIdentity.ts` | `ClinicIdentity` tipi, `isIdentityComplete()`, `CLINIC_IDENTITY` sabiti, `IDENTITY_COMPLETE` |
| `src/pages/legal/retention.ts` | `Retention` tipi, `RETENTION` sabiti (60/30) |
| `src/pages/legal/aydinlatma.<lang>.ts` | Altı içerik modülü — dokümanın o dildeki tam metni |
| `src/pages/legal/index.ts` | `LEGAL_DOCUMENTS` haritası, `getLegalDocument(lang)`, `buildShareText(lang, origin)` |
| `src/pages/Aydinlatma.tsx` | Sayfa: dil seçici, `?lang=`, TASLAK bannerı, bölüm render'ı |
| `src/features/requests/ConsentShare.tsx` | Onam kartındaki dil seçici + "linki kopyala" |
| `supabase/migrations/0060_consent_text_version.sql` | `request.consent_text_version` + `consent_lang` |

---

## Task 1: Temel katman — tipler, klinik kimlik, saklama sabitleri

**Files:**
- Create: `src/pages/legal/types.ts`
- Create: `src/pages/legal/clinicIdentity.ts`
- Create: `src/pages/legal/retention.ts`
- Test: `src/pages/legal/__tests__/retention.test.ts`

**Interfaces:**
- Consumes: hiçbir şey (ilk task).
- Produces: `SECTION_IDS`, `SectionId`, `LegalSection`, `LegalDocument`, `LEGAL_VERSION`, `ClinicIdentity`, `isIdentityComplete`, `CLINIC_IDENTITY`, `IDENTITY_COMPLETE`, `Retention`, `RETENTION`.

Sıra TDD'dir: tipler ve sabitler (Step 1-2) → başarısız test (Step 3-4) → `isIdentityComplete` implementasyonu (Step 5) → yeşil (Step 6). Step 1-2 saf tip/sabit tanımı olduğu için testten önce gelir; test edilecek davranış `isIdentityComplete`'te.

- [ ] **Step 1: `types.ts` yaz**

```ts
/** Aydınlatma metninin bölümleri — sıra sabittir, altı dilde aynıdır. */
export const SECTION_IDS = [
  'controller',   // Veri Sorumlusu
  'data',         // İşlenen Kişisel Veriler
  'purpose',      // İşleme Amaçları
  'legalBasis',   // Toplama Yöntemi ve Hukuki Sebep
  'transfer',     // Yurt Dışına Aktarım
  'retention',    // Saklama ve İmha
  'rights',       // İlgili Kişi Hakları
] as const

export type SectionId = (typeof SECTION_IDS)[number]

export type LegalSection = {
  id: SectionId
  heading: string
  paragraphs: string[]
  /** true ise vurgulu çerçevede render edilir (yurt dışı aktarım bölümü). */
  emphasis?: boolean
}

export type LegalDocument = {
  version: string
  title: string
  subtitle: string
  /** "Son güncelleme" etiketi (o dilde). */
  updatedLabel: string
  /** TASLAK bannerı metni (o dilde). */
  draftWarning: string
  /** Paylaşım şablonu — `{{link}}` yer tutucusu içerir. */
  shareMessage: string
  sections: LegalSection[]
}

/**
 * Metnin sürümü. Metin her değiştiğinde ELLE artırılır ve onam kaydına
 * (request.consent_text_version) bu değer yazılır.
 */
export const LEGAL_VERSION = '2026-07-28'
```

- [ ] **Step 2: `retention.ts` yaz**

```ts
export type Retention = {
  /** Fotoğrafların azami saklama süresi (gün). */
  photoDays: number
  /** Ameliyat tarihinden sonraki ek saklama tamponu (gün). */
  opBufferDays: number
}

/**
 * Kaynak: tenant.photo_retention_days (60) ve tenant.photo_op_buffer_days (30)
 * varsayılanları — supabase/migrations/0016_photo_lifecycle.sql.
 *
 * Public aydınlatma sayfası oturumsuz olduğu için tenant satırı okunamaz;
 * tek-klinik kararıyla sabit tutuluyor. tenant varsayılanları değişirse
 * retention.test.ts kırılır ve HUKUKİ METNİN de güncellenmesi gerektiğini
 * hatırlatır.
 */
export const RETENTION: Retention = {
  photoDays: 60,
  opBufferDays: 30,
}
```

- [ ] **Step 3: Başarısız testi yaz**

`src/pages/legal/__tests__/retention.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RETENTION } from '../retention'
import { isIdentityComplete, type ClinicIdentity } from '../clinicIdentity'

const FULL: ClinicIdentity = {
  legalName: 'Örnek Sağlık Hizmetleri A.Ş.',
  address: 'Örnek Mah. Örnek Cad. No:1, İstanbul',
  email: 'kvkk@ornek.com',
  phone: '',
  verbis: '',
}

describe('RETENTION', () => {
  it('tenant varsayılanlarıyla eşleşir (0016_photo_lifecycle.sql)', () => {
    // Bu test kırıldıysa: tenant.photo_retention_days / photo_op_buffer_days
    // değişmiş olabilir. Sabiti güncellemekle YETMEZ — aydınlatma metnindeki
    // saklama süresi cümlesi de gözden geçirilmeli.
    expect(RETENTION.photoDays).toBe(60)
    expect(RETENTION.opBufferDays).toBe(30)
  })
})

describe('isIdentityComplete', () => {
  it('zorunlu üç alan doluysa true (telefon/VERBİS opsiyonel)', () => {
    expect(isIdentityComplete(FULL)).toBe(true)
  })

  it('unvan boşsa false', () => {
    expect(isIdentityComplete({ ...FULL, legalName: '' })).toBe(false)
  })

  it('adres boşsa false', () => {
    expect(isIdentityComplete({ ...FULL, address: '' })).toBe(false)
  })

  it('e-posta boşsa false', () => {
    expect(isIdentityComplete({ ...FULL, email: '' })).toBe(false)
  })

  it('yalnız boşluk karakteri dolu sayılmaz', () => {
    expect(isIdentityComplete({ ...FULL, address: '   ' })).toBe(false)
  })

  it('üç alan da boşsa false (üretimdeki başlangıç durumu)', () => {
    expect(isIdentityComplete({ legalName: '', address: '', email: '', phone: '', verbis: '' })).toBe(false)
  })
})
```

- [ ] **Step 4: Testin başarısız olduğunu doğrula**

Run: `npx vitest run src/pages/legal/__tests__/retention.test.ts`
Expected: FAIL — `Failed to resolve import "../clinicIdentity"`.

- [ ] **Step 5: `clinicIdentity.ts` yaz**

```ts
export type ClinicIdentity = {
  /** Tam ticaret unvanı. */
  legalName: string
  /** Açık (tebligat) adresi. */
  address: string
  /** KVKK m.11 başvurularının geleceği e-posta. */
  email: string
  /** Opsiyonel — boşsa metinden çıkarılır. */
  phone: string
  /** Opsiyonel VERBİS kayıt numarası — boşsa metinden çıkarılır. */
  verbis: string
}

/**
 * BEKLEYEN GİRDİ: legalName / address / email doldurulmadan sayfa TASLAK
 * modunda kalır (bkz. IDENTITY_COMPLETE). Değerler klinikten gelir; metni
 * KVKK danışmanı onaylamalıdır.
 */
export const CLINIC_IDENTITY: ClinicIdentity = {
  legalName: '',
  address: '',
  email: '',
  phone: '',
  verbis: '',
}

/**
 * Zorunlu üç kimlik alanı (unvan, adres, e-posta) dolu mu? Telefon ve VERBİS
 * opsiyoneldir. Saf fonksiyon — sabitten değil parametreden hesaplar, böylece
 * fixture'larla gerçekten test edilebilir.
 */
export function isIdentityComplete(id: ClinicIdentity): boolean {
  return Boolean(id.legalName.trim() && id.address.trim() && id.email.trim())
}

/**
 * Üretimdeki kimliğin durumu. false ise sayfa TASLAK bannerı gösterir.
 * Banner ELLE kaldırılmaz — bu bayrak düşünce kendisi kaybolur.
 */
export const IDENTITY_COMPLETE = isIdentityComplete(CLINIC_IDENTITY)
```

- [ ] **Step 6: Testin geçtiğini doğrula**

Run: `npx vitest run src/pages/legal/__tests__/retention.test.ts`
Expected: PASS (7 test — 1 RETENTION + 6 isIdentityComplete).

- [ ] **Step 7: Tip kontrolü**

Run: `npx tsc -b --noEmit`
Expected: çıktı yok, exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/pages/legal
git commit -m "feat(kvkk): aydınlatma metni temel katmanı (tipler, klinik kimlik, saklama sabitleri)"
```

---

## Task 2: Türkçe doküman + çözücü (`getLegalDocument`)

Türkçe **asıl metindir**; diğer beş dil bundan çevrilecek. Bu yüzden tam metni burada yazıyoruz.

**Files:**
- Create: `src/pages/legal/aydinlatma.tr.ts`
- Create: `src/pages/legal/index.ts`
- Test: `src/pages/legal/__tests__/legalDocuments.test.ts`

**Interfaces:**
- Consumes: Task 1'in tamamı.
- Produces: `aydinlatmaTr(identity, retention): LegalDocument`, `getLegalDocument(lang: string): LegalDocument`, `LEGAL_DOCUMENTS: Record<Lang, LegalDocumentFactory>`, `buildShareText(lang: string, origin: string): string`.

- [ ] **Step 1: Başarısız testi yaz**

`src/pages/legal/__tests__/legalDocuments.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getLegalDocument, buildShareText } from '../index'
import { SECTION_IDS, LEGAL_VERSION } from '../types'

describe('getLegalDocument', () => {
  it('tr dokümanını döner', () => {
    const doc = getLegalDocument('tr')
    expect(doc.version).toBe(LEGAL_VERSION)
    expect(doc.sections.map((s) => s.id)).toEqual([...SECTION_IDS])
  })

  it('bilinmeyen dil kodunda tr fallback', () => {
    expect(getLegalDocument('xx').title).toBe(getLegalDocument('tr').title)
  })

  it('metni henüz yazılmamış dilde tr fallback (bu task: ar)', () => {
    // Task 3 Arapça metni ekleyince bu beklenti DEĞİŞİR — o task testi günceller.
    expect(getLegalDocument('ar').title).toBe(getLegalDocument('tr').title)
  })

  it('bölge kodlu dili taban dile indirir (tr-TR → tr)', () => {
    expect(getLegalDocument('tr-TR').title).toBe(getLegalDocument('tr').title)
  })

  it('boş/null dilde tr fallback', () => {
    expect(getLegalDocument(null).title).toBe(getLegalDocument('tr').title)
    expect(getLegalDocument('').title).toBe(getLegalDocument('tr').title)
  })
})

describe('buildShareText', () => {
  it('{{link}} yer tutucusunu ?lang= linkiyle doldurur', () => {
    const text = buildShareText('tr', 'https://medtriage.rememore.workers.dev')
    expect(text).toContain('https://medtriage.rememore.workers.dev/aydinlatma?lang=tr')
    expect(text).not.toContain('{{link}}')
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx vitest run src/pages/legal/__tests__/legalDocuments.test.ts`
Expected: FAIL — `Failed to resolve import "../index"`.

- [ ] **Step 3: Türkçe dokümanı yaz**

`src/pages/legal/aydinlatma.tr.ts`:

```ts
import type { ClinicIdentity } from './clinicIdentity'
import type { Retention } from './retention'
import { type LegalDocument, LEGAL_VERSION } from './types'

export const aydinlatmaTr = (id: ClinicIdentity, r: Retention): LegalDocument => ({
  version: LEGAL_VERSION,
  title: 'Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni',
  subtitle: '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca',
  updatedLabel: 'Son güncelleme',
  draftWarning: 'TASLAK — bu metin KVKK danışmanı onaylı nihai metinle değiştirilecektir.',
  shareMessage:
    'Merhaba, talebinizi kaydediyoruz. Kişisel verilerinizin nasıl işlendiğini açıklayan aydınlatma metnini buradan okuyabilirsiniz: {{link}} — Metni okuduktan sonra onayınızı bize iletmeniz gerekmektedir.',
  sections: [
    {
      id: 'controller',
      heading: 'Veri Sorumlusu',
      paragraphs: [
        `${id.legalName}, KVKK kapsamında veri sorumlusu sıfatıyla, aşağıda açıklanan kişisel verilerinizi işlemektedir.`,
        `Adres: ${id.address}`,
        `E-posta: ${id.email}`,
        ...(id.phone ? [`Telefon: ${id.phone}`] : []),
        ...(id.verbis ? [`VERBİS kayıt numarası: ${id.verbis}`] : []),
      ],
    },
    {
      id: 'data',
      heading: 'İşlenen Kişisel Veriler',
      paragraphs: [
        'Kimlik bilgileriniz (ad, soyad), iletişim bilgileriniz (telefon, varsa e-posta) ve sağlık verileriniz (yaş, kilo, boy, cinsiyet, geçmiş ameliyatlar, bilinen hastalıklar, kullanılan ilaçlar, sigara ve alkol kullanımı) işlenmektedir.',
        'Talebinize eklediğiniz fotoğraf ve röntgen görüntüleri de kişisel veri olarak işlenir. Yüklenen görüntülerin konum ve cihaz bilgisi (EXIF) sistem tarafından otomatik olarak silinir.',
        'Sağlık verileriniz KVKK m.6 anlamında özel nitelikli kişisel veridir ve yalnızca açık rızanıza dayanarak işlenir.',
      ],
    },
    {
      id: 'purpose',
      heading: 'İşleme Amaçları',
      paragraphs: [
        'Verileriniz; talebinizin uygun uzmanlık alanındaki hekimlere yönlendirilmesi, hekim tarafından ön değerlendirme yapılması, size uygun tedavi seçeneklerinin ve fiyat teklifinin sunulması ve klinik-hasta iletişiminin yürütülmesi amaçlarıyla işlenmektedir.',
        'Verileriniz pazarlama, reklam veya profilleme amacıyla kullanılmaz; üçüncü taraf reklam ve izleme teknolojileri kullanılmamaktadır.',
      ],
    },
    {
      id: 'legalBasis',
      heading: 'Toplama Yöntemi ve Hukuki Sebep',
      paragraphs: [
        'Kişisel verileriniz, klinik personelimizle kurduğunuz iletişim kanalı (WhatsApp, telefon görüşmesi veya klinikte yüz yüze görüşme) üzerinden tarafınızca beyan edilmesi suretiyle toplanır ve personelimiz tarafından sisteme kaydedilir.',
        'Sağlık verileriniz özel nitelikli kişisel veri olduğundan, işlenmesinin hukuki sebebi KVKK m.6/2 uyarınca açık rızanızdır. Kimlik ve iletişim bilgileriniz ise KVKK m.5/2-c uyarınca sözleşmenin kurulması ve ifasıyla doğrudan ilgili olması hukuki sebebine dayanılarak işlenir.',
        'Açık rızanızı dilediğiniz zaman geri alabilirsiniz. Rızanızı geri almanız halinde verileriniz işlenmeye devam edilmez ve saklama süresi sonunda silinir; geri alma tarihine kadar gerçekleştirilmiş işlemler bundan etkilenmez.',
      ],
    },
    {
      id: 'transfer',
      heading: 'Yurt Dışına Aktarım',
      emphasis: true,
      paragraphs: [
        'Talebiniz, yapay zekâ destekli ön değerlendirme yapılabilmesi amacıyla ABD merkezli bir hizmet sağlayıcıya (yapay zekâ modeli sağlayıcısı) aktarılabilir.',
        'Bu aktarım yalnızca açık rızanız alındığında gerçekleştirilir. Rıza vermediğiniz takdirde talebiniz yapay zekâ değerlendirmesine gönderilmez ve yalnızca hekim değerlendirmesiyle işleme alınır.',
        'Aktarım öncesinde adınız ve soyadınız serbest metin alanlarından otomatik olarak maskelenir; fotoğraf ve röntgen görüntüleri yapay zekâ değerlendirmesine gönderilmez.',
        'Yapay zekâ çıktıları yalnızca hekime yol gösterici niteliktedir; tanı veya tedavi kararı münhasıran yetkili hekim tarafından verilir.',
      ],
    },
    {
      id: 'retention',
      heading: 'Saklama ve İmha',
      paragraphs: [
        `Talebinize eklediğiniz fotoğraf ve röntgen görüntüleri en fazla ${r.photoDays} gün saklanır. Ameliyat tarihi belirlenmiş ise görüntüler ameliyat tarihinden ${r.opBufferDays} gün sonrasına kadar muhafaza edilir. Süre sonunda görüntüler otomatik olarak silinir.`,
        'Kimlik, iletişim ve sağlık verileriniz, ilgili mevzuatta öngörülen saklama süreleri boyunca muhafaza edilir; süre sonunda silinir, yok edilir veya anonim hale getirilir.',
      ],
    },
    {
      id: 'rights',
      heading: 'İlgili Kişi Olarak Haklarınız',
      paragraphs: [
        'KVKK’nın 11. maddesi uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme, işlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonuç doğmasına itiraz etme ve kanuna aykırı işleme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz.',
        `Taleplerinizi ${id.email} adresine ileterek kullanabilirsiniz. Başvurunuz en geç otuz gün içinde sonuçlandırılır.`,
      ],
    },
  ],
})
```

- [ ] **Step 4: `index.ts` yaz**

```ts
import type { Lang } from '../../i18n'
import { CLINIC_IDENTITY } from './clinicIdentity'
import { RETENTION } from './retention'
import type { ClinicIdentity } from './clinicIdentity'
import type { Retention } from './retention'
import type { LegalDocument } from './types'
import { aydinlatmaTr } from './aydinlatma.tr'

export type LegalDocumentFactory = (id: ClinicIdentity, r: Retention) => LegalDocument

/**
 * Metni HAZIR olan diller. Task 3 kalan beş dili ekler.
 *
 * resolveLang bu haritanın anahtarlarına bakar (SUPPORTED'a DEĞİL): arayüzde
 * desteklenen ama hukuki metni henüz yazılmamış bir dil, sessizce yarım metin
 * göstermek yerine Türkçeye düşer.
 */
export const LEGAL_DOCUMENTS: Partial<Record<Lang, LegalDocumentFactory>> = {
  tr: aydinlatmaTr,
}

const FALLBACK: Lang = 'tr'

/** 'tr-TR' → 'tr'; metni olmayan veya bilinmeyen dil → FALLBACK. */
export function resolveLang(lang: string | undefined | null): Lang {
  const base = (lang ?? '').split('-')[0].toLowerCase()
  return base in LEGAL_DOCUMENTS ? (base as Lang) : FALLBACK
}

export function getLegalDocument(lang: string | undefined | null): LegalDocument {
  const factory = LEGAL_DOCUMENTS[resolveLang(lang)] ?? aydinlatmaTr
  return factory(CLINIC_IDENTITY, RETENTION)
}

/** Paylaşım metni: şablonun {{link}} yer tutucusuna ?lang= linki konur. */
export function buildShareText(lang: string, origin: string): string {
  const resolved = resolveLang(lang)
  const link = `${origin}/aydinlatma?lang=${resolved}`
  return getLegalDocument(resolved).shareMessage.replace('{{link}}', link)
}
```

> Task 2'de haritada yalnız `tr` var; bu yüzden fallback testi gerçek bir davranışı sınıyor (`ar` → `tr`, çünkü Arapça metin henüz yok). Task 3 haritayı doldurdukça kapsam kendiliğinden genişler ve aynı test o zaman yalnız geçersiz kodlar için fallback bekler.

- [ ] **Step 5: Testin geçtiğini doğrula**

Run: `npx vitest run src/pages/legal/__tests__/legalDocuments.test.ts`
Expected: PASS (4 test).

- [ ] **Step 6: Tip kontrolü ve tüm testler**

Run: `npx tsc -b --noEmit && npm test`
Expected: tsc çıktısı yok; vitest "Tests 276 passed" civarı (272 mevcut + yeni 6).

- [ ] **Step 7: Commit**

```bash
git add src/pages/legal
git commit -m "feat(kvkk): Türkçe aydınlatma metni + getLegalDocument/buildShareText çözücüsü"
```

---

## Task 3: Kalan beş dil (en, ar, ru, de, fr) + yapısal parite testi

**Files:**
- Create: `src/pages/legal/aydinlatma.en.ts`
- Create: `src/pages/legal/aydinlatma.ar.ts`
- Create: `src/pages/legal/aydinlatma.ru.ts`
- Create: `src/pages/legal/aydinlatma.de.ts`
- Create: `src/pages/legal/aydinlatma.fr.ts`
- Modify: `src/pages/legal/index.ts` (haritayı gerçek modüllere bağla)
- Modify: `src/pages/legal/__tests__/legalDocuments.test.ts` (parite testleri)

**Interfaces:**
- Consumes: `aydinlatmaTr` (çeviri kaynağı), Task 1 tipleri.
- Produces: `aydinlatmaEn`, `aydinlatmaAr`, `aydinlatmaRu`, `aydinlatmaDe`, `aydinlatmaFr` — hepsi `LegalDocumentFactory` imzalı.

### Çeviri sözleşmesi (her beş dil için bağlayıcı)

1. **Yapı birebir korunur:** aynı yedi bölüm, aynı `id`'ler, aynı sırada, her bölümde Türkçesiyle **aynı sayıda paragraf**. Test bunu zorlar.
2. **`KVKK` kısaltması olduğu gibi kalır**, ilk geçtiği yerde o dilde bir açıklama eklenir (ör. EN: `Turkish Personal Data Protection Law No. 6698 ("KVKK")`). Madde numaraları (`m.5/2-c`, `m.6/2`, `m.11`) o dilin gösterimiyle yazılır ama numara değişmez.
3. **Kimlik ve saklama değerleri interpolasyonla gelir** — hiçbir dilde adres/e-posta/gün sayısı sabit yazılmaz. `id.phone`/`id.verbis` koşullu ekleme deseni (`...(id.phone ? [...] : [])`) aynen korunur.
4. **`shareMessage` `{{link}}` içermek zorundadır.**
5. **Arapça:** metin sağdan sola akar ama dizede yön kontrol karakteri KULLANILMAZ — yön `dir="rtl"` ile sayfa düzeyinde çözülür. Sayısal değerler Batı Arap rakamlarıyla (`60`, `30`) yazılır, interpolasyon zaten öyle verir.
6. **Makine çevirisi yasak** (`Global Constraints`). Metinler danışman onayına gidecek; çeviri bu turda insan eliyle yazılır, uygulamanın AI çeviri altyapısından geçirilmez.
7. Türkçe metinde `’` (kesme işareti) kullanıldığı yerlerde her dil kendi tipografik doğrusunu kullanır; JSX değil düz string olduğu için kaçış gerekmez.

- [ ] **Step 1: Parite testlerini yaz (başarısız olacak)**

`src/pages/legal/__tests__/legalDocuments.test.ts` dosyasına ekle:

```ts
import { SUPPORTED } from '../../../i18n'
import { CLINIC_IDENTITY, IDENTITY_COMPLETE } from '../clinicIdentity'
import { RETENTION } from '../retention'
import { LEGAL_DOCUMENTS } from '../index'

describe('altı dil paritesi', () => {
  const docs = SUPPORTED.map((lang) => [lang, LEGAL_DOCUMENTS[lang](CLINIC_IDENTITY, RETENTION)] as const)

  it('altı dilin tamamı tanımlı ve birbirinden farklı metinler', () => {
    expect(docs).toHaveLength(6)
    const titles = new Set(docs.map(([, d]) => d.title))
    expect(titles.size).toBe(6)
  })

  it.each(docs)('%s: sürüm LEGAL_VERSION ile aynı', (_lang, doc) => {
    expect(doc.version).toBe(LEGAL_VERSION)
  })

  it.each(docs)('%s: bölüm kimlikleri ve sırası SECTION_IDS ile aynı', (_lang, doc) => {
    expect(doc.sections.map((s) => s.id)).toEqual([...SECTION_IDS])
  })

  it.each(docs)('%s: paragraf sayıları Türkçe ile aynı', (_lang, doc) => {
    const tr = LEGAL_DOCUMENTS.tr(CLINIC_IDENTITY, RETENTION)
    expect(doc.sections.map((s) => s.paragraphs.length)).toEqual(tr.sections.map((s) => s.paragraphs.length))
  })

  it.each(docs)('%s: emphasis bayrakları Türkçe ile aynı', (_lang, doc) => {
    const tr = LEGAL_DOCUMENTS.tr(CLINIC_IDENTITY, RETENTION)
    expect(doc.sections.map((s) => s.emphasis ?? false)).toEqual(tr.sections.map((s) => s.emphasis ?? false))
  })

  it.each(docs)('%s: boş başlık veya boş paragraf yok', (_lang, doc) => {
    expect(doc.title.trim()).not.toBe('')
    expect(doc.draftWarning.trim()).not.toBe('')
    expect(doc.updatedLabel.trim()).not.toBe('')
    for (const s of doc.sections) {
      expect(s.heading.trim()).not.toBe('')
      for (const p of s.paragraphs) expect(p.trim()).not.toBe('')
    }
  })

  it.each(docs)('%s: shareMessage {{link}} yer tutucusu içerir', (_lang, doc) => {
    expect(doc.shareMessage).toContain('{{link}}')
  })

  it.each(docs)('%s: kimlik tamsa yer tutucu kalıntısı yok', (_lang, doc) => {
    if (!IDENTITY_COMPLETE) return // kimlik boşken bu koruma anlamsız
    const all = doc.sections.flatMap((s) => [s.heading, ...s.paragraphs]).join(' ')
    expect(all).not.toMatch(/[[\]]/)
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx vitest run src/pages/legal/__tests__/legalDocuments.test.ts`
Expected: FAIL — "altı dilin tamamı tanımlı ve birbirinden farklı metinler" başarısız (`titles.size` 1, çünkü altı dil de Türkçeye işaret ediyor).

- [ ] **Step 3: Beş içerik modülünü yaz**

Her biri `aydinlatma.tr.ts` ile **aynı iskeleti** kullanır; yalnız metin dizeleri o dile çevrilir. Şablon (İngilizce, `controller` ve `legalBasis` bölümleri tam olarak; kalan beş bölüm aynı yöntemle çevrilir):

```ts
import type { ClinicIdentity } from './clinicIdentity'
import type { Retention } from './retention'
import { type LegalDocument, LEGAL_VERSION } from './types'

export const aydinlatmaEn = (id: ClinicIdentity, r: Retention): LegalDocument => ({
  version: LEGAL_VERSION,
  title: 'Privacy Notice on the Processing of Personal Data',
  subtitle: 'Pursuant to Turkish Personal Data Protection Law No. 6698 ("KVKK")',
  updatedLabel: 'Last updated',
  draftWarning: 'DRAFT — this text will be replaced by the final version approved by our data protection advisor.',
  shareMessage:
    'Hello, we are registering your enquiry. You can read the privacy notice explaining how your personal data is processed here: {{link}} — Please confirm to us once you have read it.',
  sections: [
    {
      id: 'controller',
      heading: 'Data Controller',
      paragraphs: [
        `${id.legalName} processes your personal data described below in its capacity as data controller under the KVKK.`,
        `Address: ${id.address}`,
        `E-mail: ${id.email}`,
        ...(id.phone ? [`Telephone: ${id.phone}`] : []),
        ...(id.verbis ? [`VERBİS registration number: ${id.verbis}`] : []),
      ],
    },
    // ... 'data' ve 'purpose' bölümleri aynı yöntemle
    {
      id: 'legalBasis',
      heading: 'Method of Collection and Legal Basis',
      paragraphs: [
        'Your personal data is collected through the communication channel you use to contact our clinic staff (WhatsApp, telephone call, or an in-person consultation at the clinic), based on your own declaration, and is recorded in our system by our staff.',
        'Because your health data constitutes special category personal data, the legal basis for processing it is your explicit consent under KVKK art. 6(2). Your identity and contact details are processed on the basis of KVKK art. 5(2)(c), being directly related to the establishment and performance of a contract.',
        'You may withdraw your explicit consent at any time. If you withdraw it, your data will not be processed further and will be deleted at the end of the retention period; processing carried out before the withdrawal is unaffected.',
      ],
    },
    // ... 'transfer' (emphasis: true), 'retention', 'rights' bölümleri aynı yöntemle
  ],
})
```

Kalan dört dil (`ar`, `ru`, `de`, `fr`) aynı iskeleti kendi dillerinde doldurur. Çeviri sözleşmesinin 7 maddesi hepsi için bağlayıcıdır.

> **Not (plan sınırı):** Yedi bölümün tam metni beş dilde yaklaşık 6.000 kelime tutuyor ve bu planın içine kopyalanması dokümanı okunamaz hale getirir. Yapıyı, sözleşmeyi ve çalışan bir örneği veriyorum; çeviri metninin kendisi bu task'ın teslimidir ve §Step 1'deki dokuz parite testi ile Task 7'deki gözden geçirme onu denetler. Türkçe metin (Task 2) tek kaynaktır.

- [ ] **Step 4: `index.ts` haritasını tamamla**

Altı dil de hazır olduğu için harita artık `Partial` değil **tam** `Record`; `getLegalDocument` içindeki `?? aydinlatmaTr` emniyet supabı da gereksizleşir ve **kaldırılır** (ölü kod bırakılmaz).

```ts
import type { Lang } from '../../i18n'
import { aydinlatmaTr } from './aydinlatma.tr'
import { aydinlatmaEn } from './aydinlatma.en'
import { aydinlatmaAr } from './aydinlatma.ar'
import { aydinlatmaRu } from './aydinlatma.ru'
import { aydinlatmaDe } from './aydinlatma.de'
import { aydinlatmaFr } from './aydinlatma.fr'

/** Altı dilin tamamının metni hazır. */
export const LEGAL_DOCUMENTS: Record<Lang, LegalDocumentFactory> = {
  tr: aydinlatmaTr,
  ar: aydinlatmaAr,
  en: aydinlatmaEn,
  ru: aydinlatmaRu,
  de: aydinlatmaDe,
  fr: aydinlatmaFr,
}

const FALLBACK: Lang = 'tr'

/** 'tr-TR' → 'tr'; bilinmeyen dil → FALLBACK. */
export function resolveLang(lang: string | undefined | null): Lang {
  const base = (lang ?? '').split('-')[0].toLowerCase()
  return base in LEGAL_DOCUMENTS ? (base as Lang) : FALLBACK
}

export function getLegalDocument(lang: string | undefined | null): LegalDocument {
  return LEGAL_DOCUMENTS[resolveLang(lang)](CLINIC_IDENTITY, RETENTION)
}
```

Task 2'deki "Task 3 kalan beş dili ekler" yorumunu güncelle.

- [ ] **Step 4b: Task 2'nin artık geçersiz olan fallback beklentisini güncelle**

Task 2, Arapça metni olmadığı için `getLegalDocument('ar')`'ın Türkçeye düştüğünü test ediyordu. Arapça metin artık var — o test **yanlış** hale geldi. `legalDocuments.test.ts` içindeki şu testi sil:

```ts
  it('metni henüz yazılmamış dilde tr fallback (bu task: ar)', () => { ... })
```

Yerine Arapça'nın artık kendi metnini döndürdüğünü doğrula:

```ts
  it('ar artık kendi metnini döner (tr fallback DEĞİL)', () => {
    expect(getLegalDocument('ar').title).not.toBe(getLegalDocument('tr').title)
  })
```

`'xx'`, `null`, `''` ve `'tr-TR'` testleri **olduğu gibi kalır** — onlar hâlâ geçerli.

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Run: `npx vitest run src/pages/legal`
Expected: PASS — parite testleri altı dil için ayrı ayrı yeşil.

- [ ] **Step 6: Tip kontrolü ve tüm testler**

Run: `npx tsc -b --noEmit && npm test`
Expected: tsc çıktısı yok; tüm testler geçer.

- [ ] **Step 7: Commit**

```bash
git add src/pages/legal
git commit -m "feat(kvkk): aydınlatma metni beş dile çevrildi (en, ar, ru, de, fr) + parite testleri"
```

---

## Task 4: Sayfa — render, dil seçici, `?lang=` parametresi

**Files:**
- Modify: `src/pages/Aydinlatma.tsx` (tamamen yeniden yazılır)
- Modify: `src/components/LanguageSwitcher.tsx:33` (sabit Türkçe `aria-label` → `t()`)
- Modify: `src/i18n/locales/<lang>/common.json` (altı dil — `languageSwitcherLabel` anahtarı)

**Interfaces:**
- Consumes: `getLegalDocument`, `resolveLang` (Task 2/3), `IDENTITY_COMPLETE`, `LEGAL_VERSION`.
- Produces: yeni public davranış — `/aydinlatma?lang=<kod>`.

- [ ] **Step 1: `common.json`'a anahtar ekle (altı dil)**

`src/i18n/locales/tr/common.json` içine: `"languageSwitcherLabel": "Dil seçimi"`
Diğer beş dosyaya karşılıkları: `en` → `"Language selection"`, `ar` → `"اختيار اللغة"`, `ru` → `"Выбор языка"`, `de` → `"Sprachauswahl"`, `fr` → `"Choix de la langue"`.

> `keyParity.test.ts` bu altı dosyanın anahtarlarının aynı olmasını zorluyor — birini atlamak testi kırar.

- [ ] **Step 2: `keyParity` testinin geçtiğini doğrula**

Run: `npx vitest run src/i18n`
Expected: PASS.

- [ ] **Step 3: `LanguageSwitcher` — `aria-label`'ı çevir ve `LANG_LABELS`'ı dışa aç**

`src/components/LanguageSwitcher.tsx` içinde `useTranslation` ekle, sabit metni değiştir ve dil etiketleri sözlüğünü `export` et (Task 5'teki `ConsentShare` aynı sözlüğü kullanacak — iki kopya tutulmaz):

```tsx
import { useTranslation } from 'react-i18next'
// ...
/** Dil etiketleri — ConsentShare de bunu kullanır (tek kaynak). */
export const LANG_LABELS: Record<Lang, string> = {
  tr: 'Türkçe',
  ar: 'العربية',
  en: 'English',
  ru: 'Русский',
  de: 'Deutsch',
  fr: 'Français',
}
// ...
export function LanguageSwitcher() {
  const { t } = useTranslation('common')
  const { lang, changeLang } = useAppLanguage()
  const activeFlag = LANG_FLAGS[(lang as Lang)] ?? LANG_FLAGS.tr
  // ...
        <button
          type="button"
          aria-label={t('languageSwitcherLabel')}
```

Mevcut `const LANG_LABELS` tanımına yalnız `export` eklenir; içerik değişmez.

- [ ] **Step 4: `Aydinlatma.tsx`'i yeniden yaz**

```tsx
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Icon } from '../components/ui/Icon'
import { getLegalDocument, resolveLang } from './legal'
import { IDENTITY_COMPLETE } from './legal/clinicIdentity'

/**
 * Public aydınlatma metni sayfası — iOS/App Store gizlilik politikası URL'i.
 *
 * Dil sırası: ?lang= parametresi (paylaşılan link) → aktif i18next dili → tr.
 * TASLAK bannerı IDENTITY_COMPLETE'e bağlıdır; elle kaldırılmaz.
 */
export function Aydinlatma() {
  const [params] = useSearchParams()
  const { i18n } = useTranslation()
  const urlLang = params.get('lang')

  // Paylaşılan link hastanın dilinde açılır: URL parametresi i18next'e uygulanır
  // (böylece <html dir> de applyDir ile doğru yöne döner).
  useEffect(() => {
    if (!urlLang) return
    const resolved = resolveLang(urlLang)
    if (resolved !== i18n.language) i18n.changeLanguage(resolved)
  }, [urlLang, i18n])

  const doc = getLegalDocument(urlLang ?? i18n.language)

  return (
    <div className="min-h-screen bg-surface py-6 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-end">
          <LanguageSwitcher />
        </div>

        {!IDENTITY_COMPLETE && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-accent-600 bg-accent-100 px-4 py-3 text-sm font-medium text-accent-700"
          >
            <Icon of={AlertTriangle} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{doc.draftWarning}</span>
          </div>
        )}

        <div className="space-y-6 rounded-xl bg-surface-card p-5 shadow-card md:p-8">
          <header className="space-y-1">
            <h1 className="font-display text-2xl text-ink-primary">{doc.title}</h1>
            <p className="text-sm text-ink-secondary">{doc.subtitle}</p>
            <p className="text-xs text-ink-secondary">
              {doc.updatedLabel}: {doc.version}
            </p>
          </header>

          {doc.sections.map((s) => (
            <section
              key={s.id}
              className={
                s.emphasis
                  ? 'space-y-2 rounded-lg border border-accent-600 bg-accent-100/60 p-4'
                  : 'space-y-2'
              }
            >
              <h2 className="font-display text-lg text-ink-primary">{s.heading}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-ink-secondary">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
```

Notlar:
- Yön (`dir`) `applyDir` tarafından `<html>` üzerinde yönetilir; sayfada fiziksel yön sınıfı yok, `text-start` varsayılanı yeterli.
- `slate-*` ham renkleri kaldırıldı → `ink-primary`/`ink-secondary` (koyu tema tutarlılığı).

- [ ] **Step 5: Elle doğrula**

Run: `npm run dev`, ardından tarayıcıda sırayla:
- `http://localhost:5173/aydinlatma` → aktif dilde metin, sağ üstte dil seçici, TASLAK bannerı görünür (kimlik boş).
- `http://localhost:5173/aydinlatma?lang=ar` → Arapça metin ve **sağdan sola düzen** (`<html dir="rtl">`).
- `http://localhost:5173/aydinlatma?lang=xx` → Türkçe metin (fallback), hata yok.
- Dil seçiciden dil değiştir → metin ve yön anında değişir.

- [ ] **Step 6: Tip kontrolü ve tüm testler**

Run: `npx tsc -b --noEmit && npm test`
Expected: temiz.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Aydinlatma.tsx src/components/LanguageSwitcher.tsx src/i18n/locales
git commit -m "feat(kvkk): aydınlatma sayfası altı dilli — dil seçici, ?lang= parametresi, veriye bağlı TASLAK bannerı"
```

---

## Task 5: Onam kartında paylaşım — dil seçici + "linki kopyala"

**Files:**
- Create: `src/features/requests/ConsentShare.tsx`
- Modify: `src/features/requests/NewRequestWizard.tsx:601-612` (onam kartı)
- Modify: `src/i18n/locales/<lang>/requests.json` (altı dil — üç yeni anahtar)
- Test: `src/features/requests/__tests__/consentShare.test.tsx`

**Interfaces:**
- Consumes: `buildShareText` (Task 2), `SUPPORTED`/`Lang`, `useToast`.
- Produces: `<ConsentShare value={lang} onChange={(l: Lang) => void} />` — seçilen dili yukarı bildiren kontrollü bileşen. `NewRequestWizard` bu dili `consentLang` olarak Task 6'ya taşır.

- [ ] **Step 1: i18n anahtarlarını ekle (altı dil)**

`requests.json` içine `newRequest` altına:

| Anahtar | tr |
|---|---|
| `consentShareTitle` | `Aydınlatma metnini hastaya gönder` |
| `consentShareCopy` | `Linki kopyala` |
| `consentShareCopied` | `Metin panoya kopyalandı` |
| `consentShareCopyFailed` | `Kopyalanamadı — linki elle seçip kopyalayın` |

Karşılıkları:

| Dil | Title | Copy | Copied | CopyFailed |
|---|---|---|---|---|
| `en` | `Send the privacy notice to the patient` | `Copy link` | `Text copied to clipboard` | `Copy failed — please select and copy the link manually` |
| `ar` | `إرسال إشعار الخصوصية إلى المريض` | `نسخ الرابط` | `تم نسخ النص` | `فشل النسخ — يرجى تحديد الرابط ونسخه يدويًا` |
| `ru` | `Отправить пациенту уведомление о конфиденциальности` | `Копировать ссылку` | `Текст скопирован` | `Не удалось скопировать — выделите и скопируйте ссылку вручную` |
| `de` | `Datenschutzhinweis an den Patienten senden` | `Link kopieren` | `Text in die Zwischenablage kopiert` | `Kopieren fehlgeschlagen — bitte den Link manuell markieren und kopieren` |
| `fr` | `Envoyer la notice de confidentialité au patient` | `Copier le lien` | `Texte copié` | `Échec de la copie — veuillez sélectionner et copier le lien manuellement` |

`consentShareCopyFailed` gerekli çünkü pano API'si güvensiz kaynakta (`http://` üzerinden LAN erişimi) çalışmaz — hata dalı sessiz bırakılmaz.

- [ ] **Step 2: Başarısız testi yaz**

`src/features/requests/__tests__/consentShare.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConsentShare } from '../ConsentShare'

const show = vi.fn()
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => ({ show }) }))

describe('ConsentShare', () => {
  beforeEach(() => {
    show.mockClear()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('kopyalanan metin seçilen dilin ?lang= linkini içerir', async () => {
    render(<ConsentShare value="ar" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /copy|kopyala|نسخ/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(copied).toContain('/aydinlatma?lang=ar')
    expect(copied).not.toContain('{{link}}')
  })

  it('kopyalama sonrası onay toast gösterir', async () => {
    render(<ConsentShare value="tr" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /copy|kopyala/i }))
    await waitFor(() => expect(show).toHaveBeenCalled())
  })
})
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `npx vitest run src/features/requests/__tests__/consentShare.test.tsx`
Expected: FAIL — `Failed to resolve import "../ConsentShare"`.

- [ ] **Step 4: `ConsentShare.tsx` yaz**

```tsx
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { SUPPORTED, type Lang } from '../../i18n'
import { LANG_LABELS } from '../../components/LanguageSwitcher'
import { buildShareText } from '../../pages/legal'

type Props = { value: Lang; onChange: (lang: Lang) => void }

/**
 * Onam kartı paylaşım satırı: satışçı hastanın dilini seçer ve aydınlatma
 * metninin linkini içeren hazır mesajı panoya kopyalar (kendi WhatsApp'ına
 * yapıştırır). Seçilen dil onam kaydına consent_lang olarak yazılır.
 */
export function ConsentShare({ value, onChange }: Props) {
  const { t } = useTranslation('requests')
  const toast = useToast()

  const copy = async () => {
    const text = buildShareText(value, window.location.origin)
    try {
      await navigator.clipboard.writeText(text)
      toast.show(t('newRequest.consentShareCopied'), 'success')
    } catch {
      toast.show(t('newRequest.consentShareCopyFailed'), 'error')
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-line bg-surface-2 p-3">
      <p className="text-sm font-medium text-ink-primary">{t('newRequest.consentShareTitle')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t('newRequest.consentShareTitle')}
          value={value}
          onChange={(e) => onChange(e.target.value as Lang)}
          className="h-9 rounded-control border border-line bg-surface px-2 text-sm text-ink-primary"
        >
          {SUPPORTED.map((code) => (
            <option key={code} value={code}>{LANG_LABELS[code]}</option>
          ))}
        </select>
        <Button variant="secondary" onClick={copy} type="button">
          <Icon of={Copy} className="me-1.5 h-4 w-4" />
          {t('newRequest.consentShareCopy')}
        </Button>
      </div>
    </div>
  )
}
```

> `LANG_LABELS` Task 4 Step 3'te `LanguageSwitcher`'dan `export` edildi — burada yeniden tanımlanmaz.

- [ ] **Step 5: Testin geçtiğini doğrula**

Run: `npx vitest run src/features/requests/__tests__/consentShare.test.tsx`
Expected: PASS (2 test).

- [ ] **Step 6: Onam kartına bağla**

`NewRequestWizard.tsx` — dil state'i ekle (diğer `useState`'lerin yanına, ~satır 110):

```tsx
const [consentLang, setConsentLang] = useState<Lang>(() => resolveLang(i18n.language))
```

`Lang` ve `resolveLang` import'larını ekle (`../../i18n`, `../../pages/legal`), `ConsentShare`'i import et; onam kartındaki `consentHint` paragrafından **sonra** yerleştir:

```tsx
        <p className="mt-2 text-sm text-muted-foreground">{t('newRequest.consentHint')}</p>
        <ConsentShare value={consentLang} onChange={setConsentLang} />
```

- [ ] **Step 7: Elle doğrula**

Run: `npm run dev` → satışçı olarak `/requests/new`, onam kartında dil seç, "Linki kopyala" → toast görünür, pano içeriğini bir metin alanına yapıştır: seçilen dilin mesajı + `?lang=<kod>` linki.

- [ ] **Step 8: Tip kontrolü, testler, commit**

```bash
npx tsc -b --noEmit && npm test
git add src/features/requests src/i18n/locales
git commit -m "feat(kvkk): onam kartında dil seçici + aydınlatma linkini kopyala"
```

---

## Task 6: Onam kaydına sürüm ve dil yazılması

**Files:**
- Create: `supabase/migrations/0060_consent_text_version.sql`
- Modify: `src/features/requests/useRequests.ts` (`NewRequestInput` + `consent` nesnesi)
- Modify: `src/features/requests/NewRequestWizard.tsx` (`submit` → `consentLang` geçir)

**Interfaces:**
- Consumes: `LEGAL_VERSION` (Task 1), `consentLang` state'i (Task 5).
- Produces: `NewRequestInput.consentLang?: string` alanı; `request.consent_text_version` / `request.consent_lang` kolonları.

- [ ] **Step 1: Migration'ı yaz**

`supabase/migrations/0060_consent_text_version.sql`:

```sql
-- Onam kaydına, hastaya İLETİLEN aydınlatma metninin sürümü ve dili.
--
-- GEREKÇE: request.consent_at/consent_channel/consented_by (0022) onamın
-- ALINDIĞINI kaydediyor ama HANGİ METNE dayandığını kaydetmiyor. Metin
-- güncellendiğinde eski onamların neye dayandığı kanıtlanamaz hale geliyor.
--
-- consent_text_version: src/pages/legal/types.ts içindeki LEGAL_VERSION değeri.
-- consent_lang: satışçının hastaya gönderdiği metnin dili (SUPPORTED içinden).
--
-- NOT: Bu iki alanı istemci yazıyor — mevcut consent_at ile aynı güven düzeyinde.
-- Hastanın onamı KENDİ eylemiyle kaydetmek ayrı bir iş (bkz. spec §9.1).
alter table request add column if not exists consent_text_version text;
alter table request add column if not exists consent_lang text;

comment on column request.consent_text_version is
  'Hastaya iletilen aydınlatma metninin sürümü (LEGAL_VERSION). Eski satırlarda null.';
comment on column request.consent_lang is
  'Aydınlatma metninin hastaya iletildiği dil kodu (tr/ar/en/ru/de/fr). Eski satırlarda null.';
```

- [ ] **Step 2: Migration'ı uygula ve doğrula**

⚠️ Bu projede Supabase CLI yapılandırması yok (`supabase/config.toml` yok, `package.json`'da migration script'i yok) — migration'lar **elle** uygulanıyor (bkz. `docs/superpowers/2026-07-23-kapsamli-denetim-raporu.md` K5). Yani `supabase db push` çalışmaz.

Uygula: dosyanın içeriğini Supabase panelindeki SQL Editor'a yapıştırıp çalıştır (önceki 59 migration'ın uygulandığı yöntem). Ardından aynı editörde doğrula:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'request' and column_name in ('consent_text_version','consent_lang');
```

Expected: iki satır (`text`, `text`).

`if not exists` kullanıldığı için tekrar çalıştırmak güvenlidir.

- [ ] **Step 3: `NewRequestInput`'a alan ekle**

`src/features/requests/useRequests.ts` — `consentGiven` alanının hemen altına:

```ts
  /** Aydınlatma metninin hastaya iletildiği dil (onam kartı seçicisi). */
  consentLang?: string
```

- [ ] **Step 4: `consent` nesnesini genişlet**

Aynı dosyada `LEGAL_VERSION` import'unu ekle (`import { LEGAL_VERSION } from '../../pages/legal/types'`) ve mevcut `consent` ifadesini değiştir:

```ts
      const consent = input.consentGiven
        ? {
            consent_at: new Date().toISOString(),
            consent_channel: 'whatsapp',
            consented_by: input.createdBy,
            consent_text_version: LEGAL_VERSION,
            consent_lang: input.consentLang ?? input.sourceLang,
          }
        : {}
```

- [ ] **Step 5: Wizard'dan geçir**

`NewRequestWizard.tsx` `submit` içindeki `consentGiven,` satırının hemen ardına:

```tsx
        consentGiven,
        consentLang,
```

- [ ] **Step 6: Uçtan uca doğrula**

Run: `npm run dev` → satışçı olarak onam kutusunu işaretle, dil seçiciden `ar` seç, talebi gönder. Ardından DB'de:

```sql
select consent_at, consent_channel, consent_text_version, consent_lang
from request order by created_at desc limit 1;
```

Expected: `consent_text_version = '2026-07-28'`, `consent_lang = 'ar'`.
Onam kutusu işaretlenmemiş bir talepte üç alanın da `null` olduğunu ayrıca doğrula.

- [ ] **Step 7: Tip kontrolü, testler, commit**

```bash
npx tsc -b --noEmit && npm test
git add supabase/migrations/0060_consent_text_version.sql src/features/requests
git commit -m "feat(kvkk): onam kaydına aydınlatma metni sürümü ve dili (migration 0060)"
```

---

## Task 7: Gözden geçirme + iOS dokümanının güncellenmesi

**Files:**
- Modify: `docs/superpowers/ios-testflight-hazirlik.md` (§4)

**Interfaces:**
- Consumes: Task 1-6'nın tamamı.
- Produces: yayına hazırlık durumunun güncel kaydı.

- [ ] **Step 1: Altı dili gözden geçir**

`npm run dev` ile altı dilin her birini `?lang=<kod>` ile aç ve kontrol et:
- Yedi bölüm de var, başlıklar o dilde, paragraf sayıları eşit.
- Arapça'da düzen sağdan sola, metin taşması/kırpılma yok.
- Hiçbir dilde Türkçe artığı cümle kalmamış.
- Kimlik boş olduğu için TASLAK bannerı altı dilde de görünüyor.

- [ ] **Step 2: `IDENTITY_COMPLETE` yolunu geçici olarak doğrula**

`clinicIdentity.ts` içine **geçici** test değerleri gir (`legalName: 'Test A.Ş.'`, `address: 'Test adres'`, `email: 'test@example.com'`), sayfayı yenile:
- TASLAK bannerı **kayboldu**.
- Metinde hiçbir yer tutucu, boş parantez veya "undefined" yok.
- `npx vitest run src/pages/legal` → yer tutucu kalıntısı testi artık aktif ve geçiyor.

Ardından **değerleri geri boşalt** ve `npx vitest run src/pages/legal` ile yeniden yeşil olduğunu doğrula. Geçici değerler commit'e girmemeli.

- [ ] **Step 3: iOS dokümanını güncelle**

`docs/superpowers/ios-testflight-hazirlik.md` §4'ü şu içerikle değiştir:

```markdown
## 4. Privacy Policy (ZORUNLU URL)
Apple, hesaplı + sağlık verili uygulamada **gizlilik politikası URL'i** ister.
- **URL:** `https://medtriage.rememore.workers.dev/aydinlatma`
- Sayfa **altı dilde** (tr, ar, en, ru, de, fr) tam metin sunar; `?lang=<kod>` ile
  doğrudan istenen dilde açılır (ör. `/aydinlatma?lang=ar`). Arapça'da RTL.
- Metin yapısı ve sürümleme: `src/pages/legal/` (bkz.
  `docs/superpowers/specs/2026-07-28-kvkk-aydinlatma-cok-dilli-design.md`).
- ⚠️ **Submit ÖNCESİ kalan TEK koşul:** `src/pages/legal/clinicIdentity.ts` içindeki
  `CLINIC_IDENTITY` doldurulmalı (ticaret unvanı, açık adres, başvuru e-postası;
  opsiyonel telefon/VERBİS). Bu alanlar boş olduğu sürece sayfa otomatik olarak
  "TASLAK" bannerı gösterir ve Apple reviewer bunu görür.
- Nihai metin KVKK danışmanı onayından geçmelidir (özellikle `legalBasis` bölümü).
```

- [ ] **Step 4: Tam doğrulama**

Run: `npx tsc -b --noEmit && npm test && npm run build`
Expected: üçü de temiz; build hatasız.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/ios-testflight-hazirlik.md
git commit -m "docs(ios): gizlilik politikası altı dilde hazır — kalan tek koşul klinik kimlik verisi"
```

---

## Kabul kriterleri (spec §12)

- [ ] `/aydinlatma` altı dilde tam metin gösteriyor; Arapça'da RTL doğru.
- [ ] `?lang=ar` linki doğrudan Arapça açıyor; geçersiz kod Türkçeye düşüyor.
- [ ] Klinik kimlik verisi boşken TASLAK bannerı görünüyor; doldurulduğunda kayboluyor ve metinde yer tutucu kalmıyor.
- [ ] Onam kartındaki "Linki kopyala" seçilen dildeki hazır mesajı panoya kopyalıyor.
- [ ] Talep oluşturulduğunda `consent_text_version` ve `consent_lang` yazılıyor; onam yoksa null kalıyor.
- [ ] `npm test`, `npx tsc -b --noEmit`, `npm run build` temiz.

## Kapsam dışı (spec §9)

- Hastanın kendi onamı (token'lı public link) — ayrı spec.
- Telefon ülke kodu kaybı (`phone.ts` / `patient_phone_norm_idx`) — ayrı iş.
- Mobil uygulama — hiç dokunulmadı.
- `patient.language`, QR kod paylaşımı, onam sürümünün arayüzde gösterimi.
