import { describe, it, expect, beforeAll } from 'vitest'
import i18n from '../index'

/**
 * Arapça (ar) 6 CLDR çoğul kategorisi gerektirir: zero/one/two/few/many/other.
 * Önceden yalnız _one/_other tanımlıydı; count=2,3,5,10,11… gibi çok yaygın değerlerde
 * i18next eşleşme bulamayıp ham anahtarı (ör. "relative.minutes") render ediyordu.
 * Bu test, artık her kategori için gerçek çeviri metninin döndüğünü doğrular.
 */
describe('AR CLDR çoğul render doğrulaması', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ar')
  })

  it('Intl.PluralRules(ar) beklenen kategorileri veriyor (varsayım kontrolü)', () => {
    const pr = new Intl.PluralRules('ar')
    expect(pr.select(0)).toBe('zero')
    expect(pr.select(1)).toBe('one')
    expect(pr.select(2)).toBe('two')
    expect(pr.select(3)).toBe('few')
    expect(pr.select(10)).toBe('few')
    expect(pr.select(11)).toBe('many')
    expect(pr.select(99)).toBe('many')
    expect(pr.select(100)).toBe('other')
  })

  it('activity.relative.minutes: count=2/3/11 için ham anahtar DEĞİL, çevrilmiş metin döner', () => {
    const t = i18n.getFixedT('ar', 'activity')
    expect(t('relative.minutes', { count: 2 })).toBe('منذ دقيقتين')
    expect(t('relative.minutes', { count: 3 })).toBe('منذ 3 دقائق')
    expect(t('relative.minutes', { count: 11 })).toBe('منذ 11 دقيقة')
    for (const count of [0, 1, 2, 3, 5, 10, 11, 15, 100]) {
      const out = t('relative.minutes', { count })
      expect(out).not.toBe('relative.minutes')
      expect(out).not.toContain('relative.minutes')
    }
  })

  it('doctors.queue.slaRemaining: count=5 (few) ham anahtar döndürmez', () => {
    const t = i18n.getFixedT('ar', 'doctors')
    expect(t('queue.slaRemaining', { count: 5 })).toBe('SLA: تبقّى 5 ساعات')
    expect(t('queue.slaRemaining', { count: 5 })).not.toContain('queue.slaRemaining')
  })

  it('requests.duplicatePanel.matchCount: count=3 (few) ve count=15 (many) doğru çekim', () => {
    const t = i18n.getFixedT('ar', 'requests')
    expect(t('duplicatePanel.matchCount', { count: 3 })).toBe('3 تطابقات محتملة بهذه البيانات')
    expect(t('duplicatePanel.matchCount', { count: 15 })).toBe('15 تطابق محتمل بهذه البيانات')
    expect(t('duplicatePanel.matchCount', { count: 3 })).not.toContain('duplicatePanel.matchCount')
  })
})
