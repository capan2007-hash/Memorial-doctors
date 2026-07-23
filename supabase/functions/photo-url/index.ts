import { createClient } from 'npm:@supabase/supabase-js@2'

// M4 arşiv fotoğrafı erişimi (FR-37/38): arşiv katmanı fotoğrafları client'ta
// doğrudan imzalanmaz; bu fonksiyon caller yetkisini doğrular, kısa ömürlü (120sn)
// imzalı URL üretir ve her erişimi audit_log'a yazar (kim/ne zaman/hangi dosya).
// Agent/sales arşive ERİŞEMEZ (yalnız koordinatör/admin veya atanan doktor).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  // Üst-düzey try/catch: erken aşamadaki (auth/DB) istisna CORS'suz platform 500'ü
  // döndürür → tarayıcıda gerçek hatayı gizleyen "CORS error". Hep CORS'lu yanıt dön.
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
    if (!me) return json({ error: 'forbidden' }, 403)

    const body = await req.json().catch(() => null)
    const photoId = body?.photoId
    if (typeof photoId !== 'string' || !photoId) return json({ error: 'photoId required' }, 400)

    const admin = createClient(url, serviceKey)
    const { data: photo } = await admin
      .from('photo').select('id, request_id, storage_path, layer, deleted_at, tenant_id')
      .eq('id', photoId).eq('tenant_id', me.tenant_id).single()
    if (!photo) return json({ error: 'not found' }, 404)
    if (photo.deleted_at) return json({ error: 'imha edildi' }, 410)

    // Yetki: koordinatör/admin/super_admin her zaman; doktor yalnız atandığı talep; agent/sales arşive ASLA.
    let allowed = ['coordinator', 'admin', 'super_admin'].includes(me.role)
    if (!allowed) {
      const { data: doctorRow } = await caller.from('doctor').select('id').eq('app_user_id', userRes.user.id).maybeSingle()
      if (doctorRow) {
        const { data: asg } = await admin
          .from('assignment').select('id').eq('request_id', photo.request_id).eq('doctor_id', doctorRow.id).maybeSingle()
        allowed = !!asg
      }
    }
    if (!allowed) return json({ error: 'forbidden' }, 403)

    const { data: signed } = await admin.storage.from('photos').createSignedUrl(photo.storage_path, 120)
    if (!signed?.signedUrl) return json({ error: 'url üretilemedi' }, 500)

    // FR-38: arşiv erişimi denetime yazılır.
    if (photo.layer === 'archive') {
      await admin.from('audit_log').insert({
        tenant_id: photo.tenant_id, actor_id: userRes.user.id, action: 'archive_access', entity: 'photo',
        after: { photo_id: photo.id, storage_path: photo.storage_path },
      })
    }
    return json({ url: signed.signedUrl }, 200)
  } catch (e) {
    console.error('photo-url error:', e instanceof Error ? e.message : String(e))
    return json({ error: 'internal' }, 500)
  }
})
