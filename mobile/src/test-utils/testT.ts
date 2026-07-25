// Testler için minimal `t` sahtesi — gerçek i18next init'ini (AsyncStorage/expo-localization)
// tetiklemeden domain katmanının `common:` anahtarlarını gerçek tr/common.json içeriğiyle çözer.
// Faz M1 Task 6: timeAgo/formatMins/scoreTier/monthlyNetChanges/topPercentLabel artık `t` alıyor.
import trCommon from '../i18n/locales/tr/common.json'

type Dict = Record<string, unknown>

export function testT(key: string, opts?: Record<string, unknown>): string {
  const path = key.replace(/^common:/, '').split('.')
  let value: unknown = trCommon as Dict
  for (const segment of path) {
    value = (value as Dict | undefined)?.[segment]
  }
  if (typeof value !== 'string') return key
  if (!opts) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(opts[name] ?? ''))
}
