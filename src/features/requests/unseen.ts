// "Bekleyen" rozeti: satışçının HENÜZ BAKMADIĞI doktor yanıtı olan talep sayısı.
// Kural: talebe en az bir doktor yanıtı gelmiş VE (hiç bakılmamış VEYA son bakış
// en yeni yanıttan ÖNCE). Böylece talebe bakıldıktan sonra gelen YENİ yanıt da sayılır.

export interface SeenRequest {
  id: string
  sales_seen_at: string | null
}

export interface ResponseStamp {
  request_id: string
  responded_at: string
}

export function countUnseenResponses(requests: SeenRequest[], responses: ResponseStamp[]): number {
  // Talep başına EN YENİ yanıt zamanı.
  const latest = new Map<string, number>()
  for (const r of responses) {
    const t = new Date(r.responded_at).getTime()
    if (Number.isNaN(t)) continue
    const prev = latest.get(r.request_id)
    if (prev == null || t > prev) latest.set(r.request_id, t)
  }

  let count = 0
  for (const req of requests) {
    const last = latest.get(req.id)
    if (last == null) continue // yanıt yok → bekleyen değil
    if (!req.sales_seen_at) { count++; continue } // hiç bakılmamış
    const seen = new Date(req.sales_seen_at).getTime()
    if (Number.isNaN(seen) || seen < last) count++ // bakıştan SONRA yeni yanıt
  }
  return count
}
