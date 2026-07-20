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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userRes } = await caller.auth.getUser()
  if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
  const { data: me } = await caller.from('app_user').select('tenant_id').eq('id', userRes.user.id).single()
  if (!me) return json({ error: 'forbidden' }, 403)

  const body = await req.json().catch(() => null)
  const requestId = body?.requestId
  if (typeof requestId !== 'string' || !requestId) return json({ error: 'requestId required' }, 400)

  const admin = createClient(url, serviceKey)
  const { data: request } = await admin.from('request').select('*')
    .eq('id', requestId).eq('tenant_id', me.tenant_id).single()
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
    return json({ ok: true, same: result.same, confidence: result.confidence }, 200)
  } catch (e) {
    await writeCheck({ ai_same: null, status: 'failed', error: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
    return json({ ok: false }, 200)
  }
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
