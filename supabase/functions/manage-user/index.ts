import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Sıfırla/pasifleştir yetkisi (src/domain/userRoles.ts canManageTarget ile BİREBİR):
// admin herkesi; koordinatör yalnız operasyonel (sales/agent/doctor).
function canManage(callerRole: string, targetRole: string): boolean {
  if (callerRole === 'admin') return true
  if (callerRole === 'coordinator') return ['sales', 'agent', 'doctor'].includes(targetRole)
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method !== 'POST') return json({ error: 'method' }, 405)
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userRes } = await caller.auth.getUser()
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
    const callerId = userRes.user.id
    const { data: me } = await caller.from('app_user').select('tenant_id, role').eq('id', callerId).single()
    if (!me || !['coordinator', 'admin'].includes(me.role)) return json({ error: 'forbidden' }, 403)

    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'bad json' }, 400)
    const { userId, action } = body
    if (!userId || !action) return json({ error: 'missing fields' }, 400)

    const admin = createClient(url, serviceKey)
    // Hedef aynı tenant'ta olmalı.
    const { data: target } = await admin.from('app_user').select('id, role, is_active, tenant_id').eq('id', userId).single()
    if (!target || target.tenant_id !== me.tenant_id) return json({ error: 'target not found' }, 404)
    if (!canManage(me.role, target.role)) return json({ error: 'not allowed for this role' }, 403)

    if (action === 'reset_password') {
      const { password } = body
      if (!password || String(password).length < 6) return json({ error: 'weak password' }, 400)
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) return json({ error: error.message }, 400)
      await admin.from('audit_log').insert({
        tenant_id: me.tenant_id, actor_id: callerId, action: 'user_password_reset', entity: 'app_user',
        after: { user_id: userId },
      }).then(() => {}, () => {})
      return json({ ok: true }, 200)
    }

    if (action === 'set_active') {
      const isActive = body.isActive === true
      if (!isActive) {
        // Kendini pasifleştiremez.
        if (userId === callerId) return json({ error: 'cannot deactivate self' }, 400)
        // Son aktif admin'i pasifleştiremez.
        if (target.role === 'admin') {
          const { count } = await admin.from('app_user').select('id', { count: 'exact', head: true })
            .eq('tenant_id', me.tenant_id).eq('role', 'admin').eq('is_active', true)
          if ((count ?? 0) <= 1) return json({ error: 'cannot deactivate last admin' }, 400)
        }
      }
      const { error } = await admin.from('app_user').update({ is_active: isActive }).eq('id', userId)
      if (error) return json({ error: error.message }, 400)
      await admin.from('audit_log').insert({
        tenant_id: me.tenant_id, actor_id: callerId, action: 'user_set_active', entity: 'app_user',
        after: { user_id: userId, is_active: isActive },
      }).then(() => {}, () => {})
      return json({ ok: true }, 200)
    }

    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
