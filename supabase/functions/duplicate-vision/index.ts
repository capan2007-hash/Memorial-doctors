import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { MODEL_ID, OUTPUT_SCHEMA, buildSystemPrompt, buildUserContent, parseVisionOutput, type DupFeedbackHint } from './vision.ts'

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
  const admin = createClient(url, serviceKey)

  // Kimlik: x-webhook-secret (route_new_request'in pg_net çağrısı). verify_jwt=false.
  const provided = req.headers.get('x-webhook-secret') ?? ''
  const { data: secretRow } = await admin
    .from('app_secret').select('value').eq('name', 'notify_webhook_secret').single()
  if (!secretRow || !timingSafeEqual(provided, secretRow.value)) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  const requestId = body?.requestId
  if (typeof requestId !== 'string' || !requestId) return json({ error: 'requestId required' }, 400)

  const { data: request } = await admin.from('request').select('*')
    .eq('id', requestId).single()
  if (!request) return json({ error: 'request not found' }, 404)
  if (!request.duplicate_of_request_id) return json({ ok: true, skipped: 'not_pending' }, 200)

  const writeCheck = async (fields: Record<string, unknown>) => {
    await admin.from('duplicate_check').upsert({
      tenant_id: request.tenant_id, request_id: request.id,
      parent_request_id: request.duplicate_of_request_id,
      model: MODEL_ID, ...fields,
    }, { onConflict: 'request_id' }).then(() => {}, () => {})
  }

  // KVKK: onam yoksa görsel karşılaştırma yapılmaz.
  if (!request.consent_at) {
    await writeCheck({ ai_same: null, status: 'ok', ai_reason: 'no_consent' })
    return json({ ok: true, skipped: 'no_consent' }, 200)
  }

  // Günlük tenant kotası (maliyet).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin.from('duplicate_check').select('id', { count: 'exact', head: true })
    .eq('tenant_id', request.tenant_id).gte('created_at', since)
  if ((count ?? 0) >= 300) {
    await writeCheck({ ai_same: null, status: 'ok', ai_reason: 'quota' })
    return json({ ok: true, skipped: 'quota' }, 200)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    await writeCheck({ ai_same: null, status: 'failed', error: 'no api key' })
    return json({ ok: false }, 200)
  }

  try {
    const [newPhotos, parentPhotos, fbRows] = await Promise.all([
      admin.from('photo').select('storage_path').eq('request_id', request.id).eq('layer', 'active').is('deleted_at', null),
      admin.from('photo').select('storage_path').eq('request_id', request.duplicate_of_request_id).eq('layer', 'active').is('deleted_at', null),
      admin.from('duplicate_feedback').select('coordinator_label, note')
        .eq('tenant_id', request.tenant_id).order('decided_at', { ascending: false }).limit(10),
    ])
    const sign = async (rows: { storage_path: string }[] | null) => {
      const out: string[] = []
      for (const p of rows ?? []) {
        const { data } = await admin.storage.from('photos').createSignedUrl(p.storage_path, 300)
        if (data?.signedUrl) out.push(data.signedUrl)
      }
      return out
    }
    const [newUrls, parentUrls] = await Promise.all([sign(newPhotos.data), sign(parentPhotos.data)])
    if (!newUrls.length || !parentUrls.length) {
      await writeCheck({ ai_same: null, status: 'warning', ai_reason: 'yetersiz fotoğraf' })
      return json({ ok: true, skipped: 'no_photos' }, 200)
    }

    const hints: DupFeedbackHint[] = (fbRows.data ?? []).map((f: { coordinator_label: 'ok' | 'not_ok'; note: string | null }) => ({ label: f.coordinator_label, note: f.note }))

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: MODEL_ID, max_tokens: 1024, thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: buildSystemPrompt(),
      // deno-lint-ignore no-explicit-any
      messages: [{ role: 'user', content: buildUserContent(newUrls, parentUrls, hints) as any }],
    })
    const textBlock = response.content.find((b) => b.type === 'text')
    const raw = textBlock && 'text' in textBlock ? textBlock.text : ''
    let parsed: unknown = null
    try { parsed = JSON.parse(raw) } catch { parsed = null }
    const result = parseVisionOutput(parsed)
    if (!result) {
      await writeCheck({ ai_same: null, status: 'failed', error: 'parse' })
      return json({ ok: false }, 200)
    }

    await writeCheck({
      ai_same: result.same, ai_confidence: result.confidence, ai_reason: result.reason,
      status: 'ok', model_version: response.model, error: null,
    })
    // Billing Faz 1: token+maliyet kaydı (best-effort).
    await recordUsage(admin, request.tenant_id, 'vision', request.id, MODEL_ID, response.usage)
    return json({ ok: true, same: result.same, confidence: result.confidence }, 200)
  } catch (e) {
    await writeCheck({ ai_same: null, status: 'failed', error: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
    return json({ ok: false }, 200)
  }
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Sabit zamanlı karşılaştırma.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

// Billing Faz 1: bir Anthropic çağrısının token+maliyetini ai_usage'a yazar (best-effort).
// deno-lint-ignore no-explicit-any
async function recordUsage(admin: any, tenantId: string, service: string, requestId: string, model: string, usage: any) {
  try {
    if (!usage) return
    const inTok = usage.input_tokens ?? 0
    const outTok = usage.output_tokens ?? 0
    const cacheW = usage.cache_creation_input_tokens ?? 0
    const cacheR = usage.cache_read_input_tokens ?? 0
    const { data: p } = await admin.from('model_price').select('*').eq('model', model).maybeSingle()
    let cost = 0
    if (p) {
      const inP = Number(p.input_usd_per_mtok) / 1e6
      const outP = Number(p.output_usd_per_mtok) / 1e6
      cost = inTok * inP + outTok * outP
        + cacheW * inP * Number(p.cache_write_multiplier)
        + cacheR * inP * Number(p.cache_read_multiplier)
    }
    await admin.from('ai_usage').insert({
      tenant_id: tenantId, service, request_id: requestId, model,
      input_tokens: inTok, output_tokens: outTok, cache_write_tokens: cacheW, cache_read_tokens: cacheR,
      cost_usd: cost,
    })
  } catch { /* yut */ }
}
