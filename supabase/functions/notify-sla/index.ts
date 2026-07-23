import { createClient } from 'npm:@supabase/supabase-js@2'

// SLA hatırlatması: run_sla_sweep() (pg_cron) pencereye giren yanıtsız atamalar
// için çağırır. Kimlik: x-webhook-secret (app_secret, sabit-zamanlı karşılaştırma).
// Kilit ekranı gizliliği: hasta adı bildirime yazılmaz.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  const provided = req.headers.get('x-webhook-secret') ?? ''
  const { data: secretRow } = await admin
    .from('app_secret').select('value').eq('name', 'notify_webhook_secret').single()
  if (!secretRow || !timingSafeEqual(provided, secretRow.value)) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  const assignmentId = body?.assignment_id
  if (typeof assignmentId !== 'string' || !assignmentId) return json({ error: 'assignment_id required' }, 400)

  try {
    const { data: assignment } = await admin
      .from('assignment').select('doctor_id, request_id').eq('id', assignmentId).single()
    if (!assignment) return json({ ok: false, reason: 'assignment yok' }, 200)

    const { data: tokens } = await admin
      .from('push_token').select('expo_token').eq('doctor_id', assignment.doctor_id)
    const to = (tokens ?? []).map((t: { expo_token: string }) => t.expo_token)
    if (to.length === 0) return json({ ok: true, sent: 0 }, 200)

    const { data: request } = await admin
      .from('request').select('tenant_id, category_id, operation_type_id').eq('id', assignment.request_id).single()
    let op = 'operasyon'
    let hoursLeft = 4
    if (request) {
      const [catRes, opRes, tenantRes] = await Promise.all([
        admin.from('category').select('name').eq('id', request.category_id).single(),
        request.operation_type_id
          ? admin.from('operation_type').select('name').eq('id', request.operation_type_id).single()
          : Promise.resolve({ data: null }),
        admin.from('tenant').select('sla_reminder_hours').eq('id', request.tenant_id).single(),
      ])
      op = opRes.data?.name ?? catRes.data?.name ?? op
      hoursLeft = tenantRes.data?.sla_reminder_hours ?? 4
    }

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(to.map((t: string) => ({
        to: t,
        title: 'SLA hatırlatması',
        body: `Yanıt bekleyen talep: ${op} — yaklaşık ${hoursLeft} saat kaldı.`,
        sound: 'default',
        data: { requestId: assignment.request_id },
      }))),
    })
    const pushJson = await pushRes.json().catch(() => null)
    // Expo push başarısızlığını Supabase log'una yaz (aksi hâlde SLA bildirimi sessizce kaybolur).
    if (!pushRes.ok) {
      console.error('notify-sla push send failed:', pushRes.status, JSON.stringify(pushJson))
    }
    return json({ ok: true, sent: to.length, expo: pushJson?.data ?? null }, 200)
  } catch (e) {
    console.error('notify-sla error:', e instanceof Error ? e.message : String(e))
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 200)
  }
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Sabit zamanlı karşılaştırma: secret tahminine karşı zamanlama sızıntısını önler.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}
