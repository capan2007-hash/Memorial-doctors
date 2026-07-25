import { describe, it, expect } from 'vitest'
import trCommon from '../locales/tr/common.json'
import enCommon from '../locales/en/common.json'
import arCommon from '../locales/ar/common.json'
import ruCommon from '../locales/ru/common.json'
import deCommon from '../locales/de/common.json'
import frCommon from '../locales/fr/common.json'
import trNav from '../locales/tr/nav.json'
import enNav from '../locales/en/nav.json'
import arNav from '../locales/ar/nav.json'
import ruNav from '../locales/ru/nav.json'
import deNav from '../locales/de/nav.json'
import frNav from '../locales/fr/nav.json'
import trAuth from '../locales/tr/auth.json'
import enAuth from '../locales/en/auth.json'
import arAuth from '../locales/ar/auth.json'
import ruAuth from '../locales/ru/auth.json'
import deAuth from '../locales/de/auth.json'
import frAuth from '../locales/fr/auth.json'
import trRequests from '../locales/tr/requests.json'
import enRequests from '../locales/en/requests.json'
import arRequests from '../locales/ar/requests.json'
import ruRequests from '../locales/ru/requests.json'
import deRequests from '../locales/de/requests.json'
import frRequests from '../locales/fr/requests.json'
import trDoctors from '../locales/tr/doctors.json'
import enDoctors from '../locales/en/doctors.json'
import arDoctors from '../locales/ar/doctors.json'
import ruDoctors from '../locales/ru/doctors.json'
import deDoctors from '../locales/de/doctors.json'
import frDoctors from '../locales/fr/doctors.json'
import trAdmin from '../locales/tr/admin.json'
import enAdmin from '../locales/en/admin.json'
import arAdmin from '../locales/ar/admin.json'
import ruAdmin from '../locales/ru/admin.json'
import deAdmin from '../locales/de/admin.json'
import frAdmin from '../locales/fr/admin.json'
import trAi from '../locales/tr/ai.json'
import enAi from '../locales/en/ai.json'
import arAi from '../locales/ar/ai.json'
import ruAi from '../locales/ru/ai.json'
import deAi from '../locales/de/ai.json'
import frAi from '../locales/fr/ai.json'
import trActivity from '../locales/tr/activity.json'
import enActivity from '../locales/en/activity.json'
import arActivity from '../locales/ar/activity.json'
import ruActivity from '../locales/ru/activity.json'
import deActivity from '../locales/de/activity.json'
import frActivity from '../locales/fr/activity.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`])
}

/**
 * i18next CLDR çoğul son ekleri (`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`) dile göre
 * farklı sayıda kategori gerektirir (ör. Arapça 6 kategori, TR/EN pratikte 2). Bu yüzden ham
 * anahtar kümesi dile göre değişir — bu beklenen ve doğru bir durumdur. Parite karşılaştırması
 * bu son ekleri sıyırıp TABAN anahtara indirger; her dilde aynı TABAN anahtar seti olmalı, ama
 * hangi CLDR kategorilerinin tanımlı olduğu dile özgü kalabilir.
 */
const PLURAL_SUFFIX_RE = /_(?:zero|one|two|few|many|other)$/

function baseKeys(obj: object): string[] {
  const withSuffixes = keys(obj)
  const base = new Set(withSuffixes.map((k) => k.replace(PLURAL_SUFFIX_RE, '')))
  return [...base].sort()
}

describe('i18n key parity', () => {
  it.each([
    ['common', trCommon, enCommon, arCommon, ruCommon, deCommon, frCommon],
    ['nav', trNav, enNav, arNav, ruNav, deNav, frNav],
    ['auth', trAuth, enAuth, arAuth, ruAuth, deAuth, frAuth],
    ['requests', trRequests, enRequests, arRequests, ruRequests, deRequests, frRequests],
    ['doctors', trDoctors, enDoctors, arDoctors, ruDoctors, deDoctors, frDoctors],
    ['admin', trAdmin, enAdmin, arAdmin, ruAdmin, deAdmin, frAdmin],
    ['ai', trAi, enAi, arAi, ruAi, deAi, frAi],
    ['activity', trActivity, enActivity, arActivity, ruActivity, deActivity, frActivity],
  ])('%s: EN, AR, RU, DE ve FR, TR ile aynı TABAN anahtarlara sahip (çoğul son ekleri hariç)', (_ns, tr, en, ar, ru, de, fr) => {
    const t = baseKeys(tr)
    expect(t.length).toBeGreaterThan(0)
    expect(baseKeys(en)).toEqual(t)
    expect(baseKeys(ar)).toEqual(t)
    expect(baseKeys(ru)).toEqual(t)
    expect(baseKeys(de)).toEqual(t)
    expect(baseKeys(fr)).toEqual(t)
  })
})
