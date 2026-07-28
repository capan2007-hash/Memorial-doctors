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
