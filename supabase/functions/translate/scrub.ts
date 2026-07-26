// ⚠️ KOPYA — canonical: supabase/functions/ai-triage/scrub.ts (vitest oradan test eder).
// Supabase edge fonksiyonları bağımsız paketlendiğinden burada bir kopya tutulur;
// ai-triage/scrub.ts değişirse burayı da senkronla. translate yalnız scrubPii kullanır.
//
// scrubPii: LLM'e gönderilen serbest metindeki kaza kaynaklı PII'yi
// (TC kimlik no, telefon, e-posta, IBAN) maskeler.

const MASK = '[maskelendi]'

const IBAN_RE = /\bTR\s*\d{2}(?:[ ]?\d{4}){5}[ ]?\d{2}\b/gi
const EMAIL_RE = /[\p{L}\d._%+-]+@[\w-]+\.[\w.-]+/gu
const PHONE_RE = /(?:(?:\+90|0)[\s-]?\(?\d{3}\)?|\(?5\d{2}\)?)[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g
const TC_RE = /(?<!\d)\d{11}(?!\d)/g

export function scrubPii(text: string): string {
  if (!text) return text
  let out = text
  out = out.replace(IBAN_RE, MASK)
  out = out.replace(EMAIL_RE, MASK)
  out = out.replace(PHONE_RE, MASK)
  out = out.replace(TC_RE, MASK)
  return out
}
