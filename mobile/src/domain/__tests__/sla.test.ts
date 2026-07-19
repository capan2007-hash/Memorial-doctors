// Kaynak: /src/domain/__tests__/sla.test.ts (web) — kilit senaryolar mobil jest'e taşındı.
import { slaInfo, slaLabel } from '../sla'

const SLA_HOURS = 24
const REMINDER_HOURS = 4
const now = new Date('2026-07-19T12:00:00.000Z')

function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 3_600_000).toISOString()
}

describe('slaInfo', () => {
  it('yanıtlanmışsa responded döner (rozet yok)', () => {
    const info = slaInfo(hoursAgo(30), SLA_HOURS, REMINDER_HOURS, true, now)
    expect(info.state).toBe('responded')
    expect(slaLabel(info)).toBeNull()
  })

  it('assignedAt null ise ok, hoursLeft = slaHours', () => {
    const info = slaInfo(null, SLA_HOURS, REMINDER_HOURS, false, now)
    expect(info.state).toBe('ok')
    expect(info.hoursLeft).toBe(SLA_HOURS)
    expect(slaLabel(info)).toBeNull()
  })

  it('SLA içinde ve hatırlatma penceresi dışında ise ok (rozet yok)', () => {
    const info = slaInfo(hoursAgo(1), SLA_HOURS, REMINDER_HOURS, false, now) // 23s kaldı
    expect(info.state).toBe('ok')
    expect(info.hoursLeft).toBe(23)
    expect(slaLabel(info)).toBeNull()
  })

  it('tam hatırlatma eşiğinde (kalan == reminderHours) warning', () => {
    const info = slaInfo(hoursAgo(20), SLA_HOURS, REMINDER_HOURS, false, now) // tam 4s kaldı
    expect(info.state).toBe('warning')
    expect(info.hoursLeft).toBe(4)
    expect(slaLabel(info)).toBe('SLA: 4s kaldı')
  })

  it('tam SLA sınırında (kalan == 0) henüz aşılmamış sayılır, warning', () => {
    const info = slaInfo(hoursAgo(24), SLA_HOURS, REMINDER_HOURS, false, now)
    expect(info.state).toBe('warning')
    expect(info.hoursLeft).toBe(0)
    expect(slaLabel(info)).toBe('SLA: 0s kaldı')
  })

  it('SLA aşıldığında overdue, aşım saati aşağı yuvarlanır (floor)', () => {
    const info = slaInfo(hoursAgo(25.9), SLA_HOURS, REMINDER_HOURS, false, now) // 1.9s aşım -> floor 1
    expect(info.state).toBe('overdue')
    expect(info.hoursOver).toBe(1)
    expect(slaLabel(info)).toBe('SLA aşıldı · 1s')
  })

  it('büyük aşımlarda doğru saat hesabı', () => {
    const info = slaInfo(hoursAgo(30), SLA_HOURS, REMINDER_HOURS, false, now)
    expect(info.state).toBe('overdue')
    expect(info.hoursOver).toBe(6)
    expect(slaLabel(info)).toBe('SLA aşıldı · 6s')
  })
})
