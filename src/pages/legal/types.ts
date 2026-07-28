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
