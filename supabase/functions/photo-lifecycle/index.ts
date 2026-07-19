import { createClient } from 'npm:@supabase/supabase-js@2'

// M4 fotoğraf yaşam döngüsü (BRD §7.8).
// mode='archive': JWT'li kullanıcı (sale_done sonrası) — aktif fotoğrafları arşiv
//   katmanına TAŞIR (tek nüsha, .move); yetki koordinatör/admin veya talebin satışçısı.
// mode='sweep': x-webhook-secret (pg_cron) — retention/tampon dolan fotoğrafları imha eder.
// Her taşıma/imha audit_log'a yazılır (FR-38/39). Silinen satır KALIR (metadata).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder(), ab = enc.encode(a), bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

function archivePath(activePath: string): string {
  // <tenant>/<request>/<dosya>  →  <tenant>/archive/<request>/<dosya>
  const parts = activePath.split('/')
  if (parts.length < 2) return `archive/${activePath}`
  return `${parts[0]}/archive/${parts.slice(1).join('/')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(url, serviceKey)

  const body = await req.json().catch(() => null)
  const mode = body?.mode

  // ---- SWEEP: pg_cron, secret'li, tenant genelinde imha ----
  if (mode === 'sweep') {
    const provided = req.headers.get('x-webhook-secret') ?? ''
    const { data: secretRow } = await admin
      .from('app_secret').select('value').eq('name', 'notify_webhook_secret').single()
    if (!secretRow || !timingSafeEqual(provided, secretRow.value)) return json({ error: 'unauthorized' }, 401)

    let purged = 0
    const { data: photosA } = await admin.rpc('photos_due_purge')
    for (const p of (photosA ?? []) as { photo_id: string; storage_path: string; tenant_id: string; reason: string }[]) {
      // Storage silme başarısızsa satırı imha işaretleme: aksi halde disk'te orphan
      // kalır ama KVKK'da imha sayılır ve deleted_at guard'ı retry'ı engeller.
      const { error: rmErr } = await admin.storage.from('photos').remove([p.storage_path])
      if (rmErr) continue
      await admin.from('photo').update({ deleted_at: new Date().toISOString(), deletion_reason: p.reason }).eq('id', p.photo_id)
      await admin.from('audit_log').insert({
        tenant_id: p.tenant_id, actor_id: null, action: 'photo_purged', entity: 'photo',
        after: { photo_id: p.photo_id, reason: p.reason },
      })
      purged++
    }
    return json({ ok: true, purged }, 200)
  }

  // ---- ARCHIVE: JWT'li kullanıcı, sale_done sonrası ----
  if (mode === 'archive') {
    const authHeader = req.headers.get('Authorization') ?? ''
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userRes } = await caller.auth.getUser()
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
    const { data: me } = await caller.from('app_user').select('tenant_id, role').eq('id', userRes.user.id).single()
    if (!me) return json({ error: 'forbidden' }, 403)

    const requestId = body?.requestId
    if (typeof requestId !== 'string' || !requestId) return json({ error: 'requestId required' }, 400)

    const { data: request } = await admin
      .from('request').select('id, tenant_id, created_by').eq('id', requestId).eq('tenant_id', me.tenant_id).single()
    if (!request) return json({ error: 'request not found' }, 404)
    const allowed = ['coordinator', 'admin'].includes(me.role) || request.created_by === userRes.user.id
    if (!allowed) return json({ error: 'forbidden' }, 403)

    const { data: photos } = await admin
      .from('photo').select('id, storage_path').eq('request_id', requestId).eq('layer', 'active').is('deleted_at', null)
    let moved = 0
    for (const p of (photos ?? []) as { id: string; storage_path: string }[]) {
      const dest = archivePath(p.storage_path)
      const { error: mvErr } = await admin.storage.from('photos').move(p.storage_path, dest)
      if (mvErr) continue
      await admin.from('photo').update({ layer: 'archive', storage_path: dest }).eq('id', p.id)
      await admin.from('audit_log').insert({
        tenant_id: request.tenant_id, actor_id: userRes.user.id, action: 'photo_archived', entity: 'photo',
        after: { photo_id: p.id, from: p.storage_path, to: dest },
      })
      moved++
    }
    return json({ ok: true, moved }, 200)
  }

  return json({ error: 'invalid mode' }, 400)
})
