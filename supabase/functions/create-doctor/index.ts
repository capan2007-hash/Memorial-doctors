import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes } = await caller.auth.getUser()
  if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
  const { data: me } = await caller.from('app_user').select('tenant_id, role').eq('id', userRes.user.id).single()
  if (!me || !['coordinator', 'admin'].includes(me.role)) return json({ error: 'forbidden' }, 403)

  const body = await req.json().catch(() => null)
  if (!body) return json({ error: 'bad json' }, 400)
  const { email, password, fullName, title, specialty, bio, weightedWork, scopes } = body
  if (!email || !password || !fullName) return json({ error: 'missing fields' }, 400)
  // En az bir yetkinlik zorunlu: doctor.category_id NOT NULL ve scope olmadan
  // doktor hiçbir talebe düşmez. Ayrıca aşağıdaki yarım-hata riskini azaltır.
  if (!Array.isArray(scopes) || scopes.length === 0) return json({ error: 'scopes required' }, 400)

  const admin = createClient(url, serviceKey)
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (cErr || !created?.user) return json({ error: cErr?.message ?? 'create user failed' }, 400)
  const uid = created.user.id

  // createUser'dan sonraki herhangi bir hata yetim hesap bırakmasın: telafi olarak sil.
  const fail = async (msg: string) => {
    await admin.auth.admin.deleteUser(uid).catch(() => {})
    return json({ error: msg }, 400)
  }

  const { error: auErr } = await admin.from('app_user').insert({
    id: uid, tenant_id: me.tenant_id, role: 'doctor', full_name: fullName, email,
  })
  if (auErr) return fail(auErr.message)

  const primaryCategory = scopes[0]?.categoryId ?? null
  const { data: doc, error: dErr } = await admin.from('doctor').insert({
    tenant_id: me.tenant_id, app_user_id: uid, title, specialty, bio,
    weighted_work: weightedWork ?? { items: [], note: '' },
    category_id: primaryCategory, is_active: true,
  }).select('id').single()
  if (dErr || !doc) {
    await admin.from('app_user').delete().eq('id', uid).catch(() => {})
    return fail(dErr?.message ?? 'create doctor failed')
  }

  const rows = scopes.map((s: { categoryId: string; subcategoryId: string | null }) => ({
    tenant_id: me.tenant_id, doctor_id: doc.id,
    category_id: s.categoryId, subcategory_id: s.subcategoryId ?? null,
  }))
  const { error: sErr } = await admin.from('doctor_scope').insert(rows)
  if (sErr) {
    await admin.from('doctor').delete().eq('id', doc.id).catch(() => {})
    await admin.from('app_user').delete().eq('id', uid).catch(() => {})
    return fail(sErr.message)
  }
  // Denetim: doktor oluşturma da audit'lensin (doctor_update ile simetri).
  await admin.from('audit_log').insert({
    tenant_id: me.tenant_id, actor_id: userRes.user.id, action: 'doctor_create', entity: 'doctor',
    after: { doctor_id: doc.id },
  }).catch(() => {})
  return json({ doctorId: doc.id }, 200)
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
