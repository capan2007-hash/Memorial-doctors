import type { Lang } from '../../i18n'
import { CLINIC_IDENTITY } from './clinicIdentity'
import { RETENTION } from './retention'
import type { ClinicIdentity } from './clinicIdentity'
import type { Retention } from './retention'
import type { LegalDocument } from './types'
import { aydinlatmaTr } from './aydinlatma.tr'
import { aydinlatmaEn } from './aydinlatma.en'
import { aydinlatmaAr } from './aydinlatma.ar'
import { aydinlatmaRu } from './aydinlatma.ru'
import { aydinlatmaDe } from './aydinlatma.de'
import { aydinlatmaFr } from './aydinlatma.fr'

export type LegalDocumentFactory = (id: ClinicIdentity, r: Retention) => LegalDocument

/**
 * Altı dilin tamamının metni hazır — harita SUPPORTED ile birebir örtüşür.
 *
 * resolveLang bu haritanın anahtarlarına bakar: haritada olmayan (arayüzde de
 * desteklenmeyen) bir dil Türkçeye düşer.
 */
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

/** Paylaşım metni: şablonun {{link}} yer tutucusuna ?lang= linki konur. */
export function buildShareText(lang: string, origin: string): string {
  const resolved = resolveLang(lang)
  const link = `${origin}/aydinlatma?lang=${resolved}`
  return getLegalDocument(resolved).shareMessage.replace('{{link}}', link)
}
