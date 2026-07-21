import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// RBAC: hangi rol hangi rolleri oluşturabilir (src/domain/userRoles.ts ile BİREBİR).
// Doktor bu fn'den açılmaz — DoctorAdmin/create-doctor kullanılır (yetkinlik/scope).
const CREATABLE: Record<string, string[]> = {
  super_admin: ['sales', 'agent', 'coordinator', 'admin', 'super_admin'],
  admin: ['sales', 'agent', 'coordinator', 'admin'],
  coordinator: ['sales', 'agent'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  // Top-level try/catch: beklenmedik istisnalar da CORS başlıklı 500 döner
  // (aksi halde platform CORS'suz 500 döndürüp tarayıcıda CORS hatası olur).
  try {
    if (req.method !== 'POST') return json({ error: 'method' }, 405)
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userRes } = await caller.auth.getUser()
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
    const { data: me } = await caller.from('app_user').select('tenant_id, role').eq('id', userRes.user.id).single()
    if (!me || !['coordinator', 'admin', 'super_admin'].includes(me.role)) return json({ error: 'forbidden' }, 403)

    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'bad json' }, 400)
    const { email, password, fullName, phone, role } = body
    if (!email || !password || !fullName || !role) return json({ error: 'missing fields' }, 400)
    if (!(CREATABLE[me.role] ?? []).includes(role)) return json({ error: 'role not allowed' }, 403)

    const admin = createClient(url, serviceKey)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (cErr || !created?.user) return json({ error: cErr?.message ?? 'create failed' }, 400)
    const uid = created.user.id

    const { error: auErr } = await admin.from('app_user').insert({
      id: uid, tenant_id: me.tenant_id, role, full_name: fullName, phone: phone ?? null, email,
    })
    if (auErr) {
      await admin.auth.admin.deleteUser(uid).catch(() => {})
      return json({ error: auErr.message }, 400)
    }
    await admin.from('audit_log').insert({
      tenant_id: me.tenant_id, actor_id: userRes.user.id, action: 'user_create', entity: 'app_user',
      after: { user_id: uid, role },
    }).then(() => {}, () => {})
    return json({ userId: uid }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
