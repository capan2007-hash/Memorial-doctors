// Kaynak deseni: /src/i18n/__tests__/keyParity.test.ts (web) — 6 dilin TABAN anahtar kümesi
// (çoğul son ekleri sıyrılmış) karşılaştırılır.
//
// Faz M1 Task 7: ar/en/ru/de/fr bundle'ları bağlandı — bu test artık her namespace için
// tr TABAN anahtar kümesini diğer 5 dille karşılaştırır (gerçek 6-dil parite).
import trCommon from '../locales/tr/common.json'
import trAuth from '../locales/tr/auth.json'
import trQueue from '../locales/tr/queue.json'
import trRequest from '../locales/tr/request.json'
import trProfile from '../locales/tr/profile.json'
import trAdmin from '../locales/tr/admin.json'
import trAi from '../locales/tr/ai.json'
import trDoctors from '../locales/tr/doctors.json'

import arCommon from '../locales/ar/common.json'
import arAuth from '../locales/ar/auth.json'
import arQueue from '../locales/ar/queue.json'
import arRequest from '../locales/ar/request.json'
import arProfile from '../locales/ar/profile.json'
import arAdmin from '../locales/ar/admin.json'
import arAi from '../locales/ar/ai.json'
import arDoctors from '../locales/ar/doctors.json'

import enCommon from '../locales/en/common.json'
import enAuth from '../locales/en/auth.json'
import enQueue from '../locales/en/queue.json'
import enRequest from '../locales/en/request.json'
import enProfile from '../locales/en/profile.json'
import enAdmin from '../locales/en/admin.json'
import enAi from '../locales/en/ai.json'
import enDoctors from '../locales/en/doctors.json'

import ruCommon from '../locales/ru/common.json'
import ruAuth from '../locales/ru/auth.json'
import ruQueue from '../locales/ru/queue.json'
import ruRequest from '../locales/ru/request.json'
import ruProfile from '../locales/ru/profile.json'
import ruAdmin from '../locales/ru/admin.json'
import ruAi from '../locales/ru/ai.json'
import ruDoctors from '../locales/ru/doctors.json'

import deCommon from '../locales/de/common.json'
import deAuth from '../locales/de/auth.json'
import deQueue from '../locales/de/queue.json'
import deRequest from '../locales/de/request.json'
import deProfile from '../locales/de/profile.json'
import deAdmin from '../locales/de/admin.json'
import deAi from '../locales/de/ai.json'
import deDoctors from '../locales/de/doctors.json'

import frCommon from '../locales/fr/common.json'
import frAuth from '../locales/fr/auth.json'
import frQueue from '../locales/fr/queue.json'
import frRequest from '../locales/fr/request.json'
import frProfile from '../locales/fr/profile.json'
import frAdmin from '../locales/fr/admin.json'
import frAi from '../locales/fr/ai.json'
import frDoctors from '../locales/fr/doctors.json'

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

describe('i18n key parity (6 dil: tr/ar/en/ru/de/fr)', () => {
  it.each([
    ['common', trCommon, arCommon, enCommon, ruCommon, deCommon, frCommon],
    ['auth', trAuth, arAuth, enAuth, ruAuth, deAuth, frAuth],
    ['queue', trQueue, arQueue, enQueue, ruQueue, deQueue, frQueue],
    ['request', trRequest, arRequest, enRequest, ruRequest, deRequest, frRequest],
    ['profile', trProfile, arProfile, enProfile, ruProfile, deProfile, frProfile],
    ['admin', trAdmin, arAdmin, enAdmin, ruAdmin, deAdmin, frAdmin],
    ['ai', trAi, arAi, enAi, ruAi, deAi, frAi],
    ['doctors', trDoctors, arDoctors, enDoctors, ruDoctors, deDoctors, frDoctors],
  ])('%s: tr/ar/en/ru/de/fr TABAN anahtar kümeleri birebir eşleşir', (_ns, tr, ar, en, ru, de, fr) => {
    const base = baseKeys(tr)
    expect(base.length).toBeGreaterThan(0)
    expect(baseKeys(ar)).toEqual(base)
    expect(baseKeys(en)).toEqual(base)
    expect(baseKeys(ru)).toEqual(base)
    expect(baseKeys(de)).toEqual(base)
    expect(baseKeys(fr)).toEqual(base)
  })
})
