import { describe, it, expect } from 'vitest'
import { SUPPORTED } from '../../../i18n'
import { LEGAL_DOCUMENTS } from '../index'
import { isIdentityComplete, type ClinicIdentity } from '../clinicIdentity'
import { RETENTION } from '../retention'

/**
 * Bu dosya, brief'in Step 1/Step 2'sindeki MANUEL kontrolleri (tarayıcıda
 * altı dili açıp bakmak, `clinicIdentity.ts`'ye GEÇİCİ test değerleri
 * girip TASLAK bannerının kaybolduğunu gözle doğrulamak) KALICI bir teste
 * dönüştürür. Geçici bir düzenleme geri alındığında hiçbir iz bırakmaz;
 * burada kalan test ise CLINIC_IDENTITY dolduğunda metnin doğru
 * göründüğünü sonsuza kadar garanti eder.
 *
 * ÖNEMLİ: `CLINIC_IDENTITY`'nin kendisi burada DEĞİŞTİRİLMEZ — gerçek klinik
 * verisi kasıtlı olarak henüz girilmedi. Bunun yerine `LEGAL_DOCUMENTS[lang]`
 * fabrika fonksiyonu, dolu bir fixture ile doğrudan çağrılır.
 */

const FULL_IDENTITY: ClinicIdentity = {
  legalName: 'Anadolu Sağlık Kliniği A.Ş.',
  address: 'Bağdat Caddesi No:123, Kadıköy, İstanbul',
  email: 'kvkk@anadolusaglik.example',
  phone: '+90 216 555 00 00',
  verbis: '9876543',
}

const EMPTY_IDENTITY: ClinicIdentity = {
  legalName: '',
  address: '',
  email: '',
  phone: '',
  verbis: '',
}

/** Bir paragrafın sonu "etiket + hiçbir şey" şeklinde mi bitiyor? (ör. "Adres:") */
function endsWithBareLabel(text: string): boolean {
  return /[:：]\s*$/.test(text)
}

describe('kimlik doldurulduğunda metin — kalıcı doğrulama (Step 1/2 yerine)', () => {
  const fullDocs = SUPPORTED.map(
    (lang) => [lang, LEGAL_DOCUMENTS[lang](FULL_IDENTITY, RETENTION)] as const,
  )

  it.each(fullDocs)('%s: hiçbir başlık/paragrafta [ veya ] karakteri kalmıyor', (_lang, doc) => {
    const all = doc.sections.flatMap((s) => [s.heading, ...s.paragraphs]).join(' ')
    expect(all).not.toMatch(/[[\]]/)
  })

  it.each(fullDocs)('%s: unvan, adres ve e-posta metinde gerçekten görünüyor', (_lang, doc) => {
    const all = doc.sections.flatMap((s) => [s.heading, ...s.paragraphs]).join('\n')
    expect(all).toContain(FULL_IDENTITY.legalName)
    expect(all).toContain(FULL_IDENTITY.address)
    expect(all).toContain(FULL_IDENTITY.email)
  })

  it.each(fullDocs)('%s: hiçbir paragraf çıplak etiketle bitmiyor (ör. "Adres:")', (_lang, doc) => {
    for (const s of doc.sections) {
      for (const p of s.paragraphs) {
        expect(endsWithBareLabel(p), `"${s.id}" bölümünde çıplak etiketle biten paragraf: "${p}"`).toBe(
          false,
        )
      }
    }
  })
})

describe('kimlik boşken — opsiyonel alanlar boş etiket olarak render edilmez', () => {
  it('isIdentityComplete boş fixture için false döner', () => {
    expect(isIdentityComplete(EMPTY_IDENTITY)).toBe(false)
  })

  const emptyDocs = SUPPORTED.map(
    (lang) => [lang, LEGAL_DOCUMENTS[lang](EMPTY_IDENTITY, RETENTION)] as const,
  )
  const fullDocs = SUPPORTED.map(
    (lang) => [lang, LEGAL_DOCUMENTS[lang](FULL_IDENTITY, RETENTION)] as const,
  )

  it.each(SUPPORTED)(
    '%s: telefon/VERBİS boşken "controller" bölümünde tamamen yok (boş etiket değil)',
    (lang) => {
      const emptyDoc = emptyDocs.find(([l]) => l === lang)![1]
      const fullDoc = fullDocs.find(([l]) => l === lang)![1]
      const emptyController = emptyDoc.sections.find((s) => s.id === 'controller')!
      const fullController = fullDoc.sections.find((s) => s.id === 'controller')!

      // Tek fark, phone/verbis'in koşullu eklenen İKİ opsiyonel satırı olmalı:
      // boş kimlikte bu iki satır dizide TAMAMEN YOK — "Telefon:" / "VERBİS
      // kayıt numarası:" gibi boş etiketli bir satır olarak da görünmüyor.
      // (Not: aynı bölümdeki "Adres:"/"E-posta:" satırları burada kasıtlı
      // olarak kontrol EDİLMİYOR — CLINIC_IDENTITY dolana kadar bunların çıplak
      // görünmesi bilinen, kabul edilmiş TASLAK durumudur; bu test yalnızca
      // opsiyonel phone/VERBİS satırlarının "boş etiket" olarak sızmadığını,
      // tamamen yok olduğunu kanıtlamayı amaçlar.)
      expect(emptyController.paragraphs.length).toBe(fullController.paragraphs.length - 2)
    },
  )
})
