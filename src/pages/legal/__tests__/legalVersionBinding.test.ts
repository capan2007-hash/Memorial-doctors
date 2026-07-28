/// <reference types="node" />
import { createHash } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { LEGAL_DOCUMENTS } from '../index'
import { LEGAL_VERSION } from '../types'
import type { ClinicIdentity } from '../clinicIdentity'
import type { Retention } from '../retention'

/**
 * LEGAL_VERSION elle artırılan bir sabittir. Biri metni değiştirip sürümü
 * artırmayı unutursa, onam kaydına (request.consent_text_version) yazılan
 * değer artık gösterilen metni doğru temsil etmez — ve bu sessizce olur.
 *
 * Bu test, altı dilin TAMAMININ render edilmiş metnini tek bir özet
 * (digest) haline getirip LEGAL_VERSION ile birlikte sabitler. Metin
 * değişirse digest değişir; digest ile LEGAL_VERSION'ın kaydı burada
 * eşleşmezse test kırılır ve hem sürümün hem de bu testteki digest'in
 * güncellenmesi gerektiğini hatırlatır.
 *
 * Kimlik ve saklama süresi SABİT bir fixture ile veriliyor (gerçek
 * CLINIC_IDENTITY / RETENTION DEĞİL) — böylece klinik bilgileri
 * doldurulduğunda (legalName/address/email) hukuki metin değişmediği
 * halde digest de değişmez.
 */

const FIXTURE_IDENTITY: ClinicIdentity = {
  legalName: 'Sabit Test Kliniği A.Ş.',
  address: 'Sabit Test Mahallesi, Sabit Test Caddesi No:1, İstanbul',
  email: 'kvkk@sabit-test.example',
  phone: '+90 212 000 00 00',
  verbis: '1234567',
}

const FIXTURE_RETENTION: Retention = {
  photoDays: 60,
  opBufferDays: 30,
}

/** Diller sabit, sıralı ve açık bir liste olarak dolaşılır (nondeterminizm yok). */
const LANGS = ['ar', 'de', 'en', 'fr', 'ru', 'tr'] as const

/** Altı dokümanın tüm görünür metnini sabit bir sırayla tek bir dizgede birleştirir. */
function collectAllText(): string {
  const parts: string[] = []
  for (const lang of LANGS) {
    const doc = LEGAL_DOCUMENTS[lang](FIXTURE_IDENTITY, FIXTURE_RETENTION)
    parts.push(doc.title, doc.subtitle, doc.updatedLabel, doc.draftWarning, doc.shareMessage)
    for (const section of doc.sections) {
      parts.push(section.heading, ...section.paragraphs)
    }
  }
  // Ayırıcı olarak NUL: hukuki metinde asla geçmez, dolayısıyla iki farklı
  // paragraf birleşimi kazara aynı özeti üretemez. String.fromCharCode(0) ile
  // yazılır — kaynağa HAM NUL baytı konursa git dosyayı İKİLİ sayar ve dosya
  // bir daha diff'lenemez/review edilemez hale gelir.
  return parts.join(String.fromCharCode(0))
}

function digestOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Bu ikili (digest, LEGAL_VERSION) kayıtlıdır. İkisinden biri diğeriyle
 * uyumsuz hale gelirse (metin değişti ama sürüm aynı kaldı, ya da sürüm
 * değişti ama metin aynı kaldı) test kırılır.
 */
const RECORDED_DIGEST = '00f8a7e1aa79987765c8803a8c3e55d25ef4bb511a464c6dd92da3e65739c7e4'
const RECORDED_LEGAL_VERSION = '2026-07-28'

describe('LEGAL_VERSION — metin/sürüm bağlayıcılığı', () => {
  it('kayıtlı LEGAL_VERSION hâlâ types.ts ile aynı', () => {
    // Bu ayrı assertion, digest'in kendisi bozulmadan sırf LEGAL_VERSION
    // değiştirildiğinde de testin kırılmasını garanti eder.
    expect(LEGAL_VERSION).toBe(RECORDED_LEGAL_VERSION)
  })

  it('altı dilin tam metninin özeti (digest), kayıtlı LEGAL_VERSION ile eşleşen değerle aynı', () => {
    const digest = digestOf(collectAllText())

    if (digest !== RECORDED_DIGEST) {
      throw new Error(
        'Aydınlatma metninin içeriği değişti (bu testteki digest artık uyuşmuyor).\n' +
          `Kayıtlı LEGAL_VERSION: ${RECORDED_LEGAL_VERSION} — kayıtlı digest: ${RECORDED_DIGEST}\n` +
          `Hesaplanan digest:     ${digest}\n\n` +
          'Yapılması gerekenler:\n' +
          '1) src/pages/legal/types.ts içindeki LEGAL_VERSION\'ı yeni bir tarihe ELLE artırın ' +
          '(bu değer onam kaydına — request.consent_text_version — yazılır).\n' +
          '2) Bu dosyadaki RECORDED_DIGEST ve RECORDED_LEGAL_VERSION değerlerini güncelleyin.\n' +
          'Metin değişmediyse (örn. sadece boşluk/biçim), digest\'in neden değiştiğini araştırın; ' +
          'kimlik/saklama fixture\'ı SABİTTİR, gerçek metin dışında bir şey digest\'i etkilememelidir.',
      )
    }

    expect(digest).toBe(RECORDED_DIGEST)
  })
})
