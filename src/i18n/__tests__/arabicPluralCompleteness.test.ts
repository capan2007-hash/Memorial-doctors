import { describe, it, expect } from 'vitest'

/**
 * Regresyon koruması: Arapça (ar) 6 CLDR çoğul kategorisi gerektirir
 * (`zero`, `one`, `two`, `few`, `many`, `other` — bkz. arabicPlurals.test.ts).
 *
 * Bu test, `src/i18n/locales/ar/*.json` altındaki TÜM dosyaları Vite'ın
 * `import.meta.glob` mekanizmasıyla dinamik olarak tarar (elle dosya/anahtar
 * listelemez) ve her ÇOĞULLU TABAN anahtar için (yani hem `_one` hem `_other`
 * formu tanımlı olan her taban) altı kategorinin HEPSİNİN mevcut olduğunu
 * doğrular. Böylece gelecekte bir düzenlemede AR'den bir çoğul kategori
 * (ör. `_few` veya `_two`) yanlışlıkla silinirse bu test kırılır.
 */

const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/
const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flattenKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

const arModules = import.meta.glob<Record<string, unknown>>('../locales/ar/*.json', {
  eager: true,
  import: 'default',
})

const arFiles: Array<[string, Record<string, unknown>]> = Object.entries(arModules)
  .map(([filePath, data]): [string, Record<string, unknown>] => [
    filePath.split('/').pop() ?? filePath,
    data,
  ])
  .sort((a, b) => a[0].localeCompare(b[0]))

describe('AR CLDR çoğul tamlığı (regresyon koruması)', () => {
  it('ar/ altında en az bir json dosyası bulundu (glob sağlık kontrolü)', () => {
    expect(arFiles.length).toBeGreaterThan(0)
  })

  it.each(arFiles)(
    '%s: _one ve _other tanımlı her taban anahtar için 6 CLDR kategorisinin tümü mevcut',
    (file, data) => {
      const flatKeys = flattenKeys(data)

      const suffixesByBase = new Map<string, Set<string>>()
      for (const key of flatKeys) {
        const match = key.match(PLURAL_SUFFIX_RE)
        if (!match) continue
        const base = key.slice(0, -match[0].length)
        const suffix = match[1]
        if (!suffixesByBase.has(base)) suffixesByBase.set(base, new Set())
        suffixesByBase.get(base)!.add(suffix)
      }

      const pluralBases = [...suffixesByBase.entries()].filter(
        ([, suffixes]) => suffixes.has('one') && suffixes.has('other'),
      )

      for (const [base, suffixes] of pluralBases) {
        for (const category of CATEGORIES) {
          expect(
            suffixes.has(category),
            `${file}: "${base}" taban anahtarında "_${category}" kategorisi eksik ` +
              `(mevcut: ${[...suffixes].sort().join(', ')})`,
          ).toBe(true)
        }
      }
    },
  )
})
