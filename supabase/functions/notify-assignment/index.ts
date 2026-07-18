import { createClient } from 'npm:@supabase/supabase-js@2'

// assignment INSERT webhook'u (DB trigger, pg_net) → doktorun Expo push
// token'larına bildirim. Kimlik: x-webhook-secret başlığı, app_secret
// tablosundaki değerle karşılaştırılır (verify_jwt=false). Her hata yutulur:
// bildirim, atama akışının yan ürünüdür.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  const provided = req.headers.get('x-webhook-secret') ?? ''
  const { data: secretRow } = await admin
    .from('app_secret').select('value').eq('name', 'notify_webhook_secret').single()
  if (!secretRow || provided !== secretRow.value) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  const assignmentId = body?.assignment_id
  if (typeof assignmentId !== 'string' || !assignmentId) return json({ error: 'assignment_id required' }, 400)

  try {
    const { data: assignment } = await admin
      .from('assignment').select('doctor_id, request_id').eq('id', assignmentId).single()
    if (!assignment) return json({ ok: false, reason: 'assignment yok' }, 200)

    const [tokensRes, requestRes] = await Promise.all([
      admin.from('push_token').select('expo_token').eq('doctor_id', assignment.doctor_id),
      admin.from('request').select('id, patient_id, category_id, operation_type_id').eq('id', assignment.request_id).single(),
    ])
    const tokens = (tokensRes.data ?? []).map((t: { expo_token: string }) => t.expo_token)
    if (tokens.length === 0) return json({ ok: true, sent: 0 }, 200)

    const request = requestRes.data
    let title = 'Yeni talep'
    let message = 'Yeni bir hasta talebi atandı.'
    if (request) {
      const [patientRes, catRes, opRes] = await Promise.all([
        admin.from('patient').select('first_name, last_name').eq('id', request.patient_id).single(),
        admin.from('category').select('name').eq('id', request.category_id).single(),
        request.operation_type_id
          ? admin.from('operation_type').select('name').eq('id', request.operation_type_id).single()
          : Promise.resolve({ data: null }),
      ])
      const name = patientRes.data ? `${patientRes.data.first_name} ${patientRes.data.last_name}` : 'Hasta'
      const op = opRes.data?.name ?? catRes.data?.name ?? 'operasyon'
      message = `${name} — ${op}`
    }

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map((to: string) => ({
        to, title, body: message, sound: 'default',
        data: { requestId: assignment.request_id },
      }))),
    })
    const pushJson = await pushRes.json().catch(() => null)
    return json({ ok: true, sent: tokens.length, expo: pushJson?.data ?? null }, 200)
  } catch (e) {
    // Bildirim hatası akışı durdurmaz; 200 döneriz ki pg_net retry fırtınası olmasın.
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 200)
  }
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
