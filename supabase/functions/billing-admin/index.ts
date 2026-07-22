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

    const admin = createClient(url, serviceKey)
    const body = await req.json().catch(() => ({}))

    // Faz 3: aylık altyapı maliyetini ayarla.
    if (body?.action === 'set_infra') {
      const v = Number(body.infraMonthlyUsd)
      if (!(v >= 0)) return json({ error: 'invalid amount' }, 400)
      await admin.from('platform_config').update({ infra_monthly_usd: v, updated_at: new Date().toISOString() }).eq('id', 1)
      return json({ ok: true, infraMonthlyUsd: v }, 200)
    }

    const period = body?.period === 'month' ? 'month' : 'week'
    const now = new Date()
    let start: Date
    if (period === 'month') {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    } else {
      const day = now.getUTCDay() || 7
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)))
    }
    const startIso = start.toISOString()

    const [{ data: tenants }, { data: usage }, { data: cfg }] = await Promise.all([
      admin.from('tenant').select('id, name'),
      admin.from('ai_usage').select('tenant_id, service, cost_usd, input_tokens, output_tokens').gte('created_at', startIso),
      admin.from('platform_config').select('infra_monthly_usd').eq('id', 1).maybeSingle(),
    ])

    const infraMonthly = Number(cfg?.infra_monthly_usd ?? 0)
    // Dönem altyapı maliyeti: ay=tam, hafta=aylık×7/30 (prorate).
    const infraPeriod = period === 'month' ? infraMonthly : infraMonthly * (7 / 30)

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

    // Toplam AI çağrısı (altyapı tahsis tabanı).
    let totalCalls = 0
    for (const tMap of byTenant.values()) for (const s of tMap.values()) totalCalls += s.calls

    const r6 = (n: number) => Math.round(n * 1e6) / 1e6
    const companies = (tenants ?? []).map((t: { id: string; name: string }) => {
      const services = Array.from((byTenant.get(t.id) ?? new Map<string, Svc>()).values())
        .map((s) => ({ service: s.service, cost: r6(s.cost), calls: s.calls, inTok: s.inTok, outTok: s.outTok }))
      const aiCost = services.reduce((a, s) => a + s.cost, 0)
      const calls = services.reduce((a, s) => a + s.calls, 0)
      // Altyapı: firmanın AI-çağrı payına göre (0 çağrı → 0 pay).
      const infraCost = totalCalls > 0 ? r6(infraPeriod * (calls / totalCalls)) : 0
      const totalCost = r6(aiCost + infraCost)
      return {
        tenantId: t.id, name: t.name, services,
        aiCost: r6(aiCost), infraCost, calls,
        totalCost, weeklyCharge: r6(totalCost * 2),
      }
    })
    const grandTotalCost = r6(companies.reduce((a, c) => a + c.totalCost, 0))

    return json({
      period, periodStart: startIso, currency: 'USD',
      infraMonthlyUsd: infraMonthly,
      companies,
      grandTotalCost,
      grandTotalCharge: r6(grandTotalCost * 2),
    }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
