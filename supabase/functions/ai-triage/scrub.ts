// Saf TypeScript modül: Deno'ya özgü import YOK, npm: import YOK.
// Hem Deno edge function (ai-triage/index.ts) hem de vitest tarafından
// göreli yoldan import edilir.
//
// scrubPii: LLM'e gönderilen veya depolanan serbest metinlerdeki kaza
// kaynaklı PII sızıntılarını (TC kimlik no, telefon, e-posta, IBAN) maskeler.
// Yaş/boy/kilo/yıl gibi sıradan kısa sayıları YANLIŞLIKLA maskelemez.

const MASK = '[maskelendi]'

// TR IBAN: "TR" + 24 hane, aralarda boşluk olabilir.
const IBAN_RE = /\bTR\s*\d{2}(?:[ ]?\d{4}){5}[ ]?\d{2}\b/gi

// E-posta.
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g

// Telefon: +90/0 önekli, ayraç (boşluk/tire) destekli 10 haneli TR cep/sabit no.
// Örnekler: +905551234567, 05551234567, 0555 123 45 67, 0555-123-45-67
const PHONE_RE = /(?:\+90|0)[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g

// TC kimlik no: 11 ardışık hane (kelime sınırı içinde, başka hane grubuna bitişik değil).
const TC_RE = /\b\d{11}\b/g

export function scrubPii(text: string): string {
  if (!text) return text

  let out = text
  out = out.replace(IBAN_RE, MASK)
  out = out.replace(EMAIL_RE, MASK)
  out = out.replace(PHONE_RE, MASK)
  out = out.replace(TC_RE, MASK)

  return out
}
