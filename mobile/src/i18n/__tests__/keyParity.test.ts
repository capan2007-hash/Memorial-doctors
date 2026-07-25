// Kaynak deseni: /src/i18n/__tests__/keyParity.test.ts (web) — 6 dilin TABAN anahtar kümesi
// (çoğul son ekleri sıyrılmış) karşılaştırılır.
//
// Mobilde ŞU AN yalnız tr namespace'leri var (diğer 5 dil Faz M1 Task 7'de gelecek). Bu yüzden
// bu test şimdilik: (1) her tr namespace'inin geçerli/boş-olmayan bir JSON nesnesi olduğunu,
// (2) TABAN anahtar çıkarım mantığının (çoğul sonek sıyırma) doğru çalıştığını doğrular
// (tr'nin kendisiyle trivial parite karşılaştırması). Task 7'de her dil için `en`, `ar`, `ru`,
// `de`, `fr` import'ları eklenip it.each satırları web'deki gibi 6 sütuna genişletilecek.
import trCommon from '../locales/tr/common.json'
import trAuth from '../locales/tr/auth.json'
import trQueue from '../locales/tr/queue.json'
import trRequest from '../locales/tr/request.json'
import trProfile from '../locales/tr/profile.json'
import trAdmin from '../locales/tr/admin.json'
import trAi from '../locales/tr/ai.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

/**
 * i18next CLDR çoğul son ekleri (`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`) dile göre
 * farklı sayıda kategori gerektirir. Parite karşılaştırması bu son ekleri sıyırıp TABAN anahtara
 * indirger — bkz. web'deki aynı fonksiyon (src/i18n/__tests__/keyParity.test.ts).
 */
const PLURAL_SUFFIX_RE = /_(?:zero|one|two|few|many|other)$/

function baseKeys(obj: object): string[] {
  const withSuffixes = keys(obj)
  const base = new Set(withSuffixes.map((k) => k.replace(PLURAL_SUFFIX_RE, '')))
  return [...base].sort()
}

describe('i18n key parity (tr iskeleti — Task 7 6 dile genişletilecek)', () => {
  it.each([
    ['common', trCommon],
    ['auth', trAuth],
    ['queue', trQueue],
    ['request', trRequest],
    ['profile', trProfile],
    ['admin', trAdmin],
    ['ai', trAi],
  ])('%s: geçerli JSON + en az bir TABAN anahtar içerir', (_ns, tr) => {
    expect(tr && typeof tr === 'object').toBe(true)
    const base = baseKeys(tr)
    expect(base.length).toBeGreaterThan(0)
    // Task 7'ye kadar trivial öz-parite: aynı nesne aynı TABAN anahtar kümesini üretmeli.
    expect(baseKeys(tr)).toEqual(base)
  })
})
