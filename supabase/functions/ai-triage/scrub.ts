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

// E-posta. Türkçe karakterli local-part'lar da tam maskelensin diye \b yerine
// unicode harf sınıfı kullanılır (aksi halde "ayşe.x@y.com" kısmi maskelenip ad sızar).
const EMAIL_RE = /[\p{L}\d._%+-]+@[\w-]+\.[\w.-]+/gu

// Telefon: +90/0 önekli (cep+sabit) VEYA öneksiz 5xx cep; ayraç (boşluk/tire)
// ve parantez destekli. Örnekler: +905551234567, 0555 123 45 67, (555) 123-45-67, 5551234567
const PHONE_RE = /(?:(?:\+90|0)[\s-]?\(?\d{3}\)?|\(?5\d{2}\)?)[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g

// TC kimlik no: 11 hane, önünde/arkasında başka hane yok ("TC12345678901"
// gibi harfe bitişik biçimler de yakalanır — \b harf-rakam arasında oluşmaz).
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

// Serbest metne gömülü kişi adlarını (özellikle hasta ad/soyadı) maskeler.
// `names` yalnız SUNUCUDA bilinen maskelenecek belirteçlerdir (LLM'e gitmez).
// Tam-kelime eşleşme: Türkçe/Unicode harf-rakam ile çevrili değilse eşleşir —
// böylece "Ayşe" gömülü geçse maskelenir ama "Ayşegül" içindeki parça maskelenmez.
// Büyük/küçük harf duyarsız; 2 karakterden kısa belirteçler yok sayılır
// (yanlış-pozitif maskelemeyi önler).
export function redactNames(text: string, names: string[]): string {
  if (!text || !names || names.length === 0) return text
  let out = text
  for (const raw of names) {
    const name = (raw ?? '').trim()
    if (name.length < 2) continue
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(?:${escaped})(?=[^\\p{L}\\p{N}]|$)`, 'giu')
    out = out.replace(re, (_m, pre) => `${pre}${MASK}`)
  }
  return out
}
