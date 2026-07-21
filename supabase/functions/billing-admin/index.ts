import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method !== 'POST') return json({ error: 'method' }, 405)
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // Yalnız super_admin: platform-üstü cross-tenant billing.
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userRes } = await caller.auth.getUser()
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
    const { data: me } = await caller.from('app_user').select('role').eq('id', userRes.user.id).single()
    if (!me || me.role !== 'super_admin') return json({ error: 'forbidden' }, 403)

    const body = await req.json().catch(() => ({}))
    const period = body?.period === 'month' ? 'month' : 'week'
    // week = ISO hafta başı (Pzt 00:00 UTC), month = ay başı.
    const now = new Date()
    let start: Date
    if (period === 'month') {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    } else {
      const day = now.getUTCDay() || 7 // Pazar=7
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)))
    }
    const startIso = start.toISOString()

    const admin = createClient(url, serviceKey)
    const [{ data: tenants }, { data: usage }] = await Promise.all([
      admin.from('tenant').select('id, name'),
      admin.from('ai_usage').select('tenant_id, service, cost_usd, input_tokens, output_tokens').gte('created_at', startIso),
    ])

    type Svc = { service: string; cost: number; calls: number; inTok: number; outTok: number }
    const byTenant = new Map<string, Map<string, Svc>>()
    for (const u of usage ?? []) {
      const tMap = byTenant.get(u.tenant_id) ?? new Map<string, Svc>()
      const s = tMap.get(u.service) ?? { service: u.service, cost: 0, calls: 0, inTok: 0, outTok: 0 }
      s.cost += Number(u.cost_usd) || 0
      s.calls += 1
      s.inTok += u.input_tokens || 0
      s.outTok += u.output_tokens || 0
      tMap.set(u.service, s)
      byTenant.set(u.tenant_id, tMap)
    }

    const companies = (tenants ?? []).map((t: { id: string; name: string }) => {
      const services = Array.from((byTenant.get(t.id) ?? new Map<string, Svc>()).values())
        .map((s) => ({ service: s.service, cost: Math.round(s.cost * 1e6) / 1e6, calls: s.calls, inTok: s.inTok, outTok: s.outTok }))
      const totalCost = services.reduce((a, s) => a + s.cost, 0)
      return {
        tenantId: t.id, name: t.name, services,
        totalCost: Math.round(totalCost * 1e6) / 1e6,
        weeklyCharge: Math.round(totalCost * 2 * 1e6) / 1e6, // haftalık 2× (reseller markup)
      }
    })
    const grandTotalCost = companies.reduce((a, c) => a + c.totalCost, 0)

    return json({
      period, periodStart: startIso, currency: 'USD',
      companies,
      grandTotalCost: Math.round(grandTotalCost * 1e6) / 1e6,
      grandTotalCharge: Math.round(grandTotalCost * 2 * 1e6) / 1e6,
    }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
