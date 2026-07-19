// Kaynak: /src/domain/sla.ts (web) — mobil kuyruk rozetleri için birebir kopya
// (Metro repo-kökü dışı import kısıtı nedeniyle domain kopyalanır, bkz. types/db.ts).
// FR-24/25/26/29: SLA geri sayımı — koordinatör gecikme panosu ve doktor kuyruğu rozetleri
// bu saf fonksiyonlardan türetilir (bkz. migration 0014 run_sla_sweep ile tutarlı sınır kuralları).

export interface SlaInfo {
  state: 'responded' | 'ok' | 'warning' | 'overdue'
  hoursLeft: number
  hoursOver: number
}

/**
 * assignedAt + slaHours penceresine göre durum hesabı.
 * - hasResponse: doktor zaten yanıtladıysa (kabul/red) rozet gösterilmez.
 * - assignedAt null: henüz atanmamış, SLA saati tam kalmış kabul edilir (ok).
 * - Sınır kuralı run_sla_sweep ile tutarlı: yalnız "şimdi > assignedAt + slaHours" aşımdır (>),
 *   tam sınırda (== ) henüz aşılmamış sayılır.
 * - Kalan saat yukarı (ceil), aşım saati aşağı (floor) yuvarlanır.
 */
export function slaInfo(
  assignedAt: string | null,
  slaHours: number,
  reminderHours: number,
  hasResponse: boolean,
  now: Date = new Date(),
): SlaInfo {
  if (hasResponse) return { state: 'responded', hoursLeft: 0, hoursOver: 0 }
  if (assignedAt == null) return { state: 'ok', hoursLeft: slaHours, hoursOver: 0 }

  const elapsedHours = (now.getTime() - new Date(assignedAt).getTime()) / 3_600_000
  const remaining = slaHours - elapsedHours

  if (remaining < 0) {
    return { state: 'overdue', hoursLeft: 0, hoursOver: Math.floor(-remaining) }
  }

  const hoursLeft = Math.ceil(remaining)
  const state = remaining <= reminderHours ? 'warning' : 'ok'
  return { state, hoursLeft, hoursOver: 0 }
}

export function slaLabel(info: SlaInfo): string | null {
  switch (info.state) {
    case 'warning':
      return `SLA: ${info.hoursLeft}s kaldı`
    case 'overdue':
      return `SLA aşıldı · ${info.hoursOver}s`
    default:
      return null
  }
}
