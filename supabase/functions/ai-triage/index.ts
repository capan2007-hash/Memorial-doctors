import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import {
  MODEL_ID,
  DISCLAIMER,
  buildSystemPrompt,
  buildUserContent,
  parseTriageOutput,
  OUTPUT_SCHEMA,
  type TriageContext,
  type FeedbackHint,
} from './triage.ts'

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

  // Çağıran doğrulaması: herhangi bir authenticated tenant kullanıcısı tetikleyebilir.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes } = await caller.auth.getUser()
  if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
  const { data: me } = await caller
    .from('app_user').select('tenant_id').eq('id', userRes.user.id).single()
  if (!me) return json({ error: 'forbidden' }, 403)

  const body = await req.json().catch(() => null)
  const requestId = body?.requestId
  if (typeof requestId !== 'string' || !requestId) return json({ error: 'requestId required' }, 400)

  const admin = createClient(url, serviceKey)

  // Talep çağıranın tenant'ında olmalı — başka tenant için tetiklenemez.
  const { data: request } = await admin
    .from('request').select('*').eq('id', requestId).eq('tenant_id', me.tenant_id).single()
  if (!request) return json({ error: 'request not found' }, 404)

  // KVKK onam kapısı (P1): onam yoksa yurt dışına (Anthropic) HİÇBİR veri gitmez.
  // Client zaten onamsız invoke etmiyor; bu savunma derinliğidir. Değerlendirme
  // üretilmez, failed de yazılmaz — talep akışı bundan etkilenmez.
  if (!request.consent_at) return json({ ok: true, skipped: 'no_consent' }, 200)

  // P1-3: tenant başına günlük kota — maliyet istismarını sınırlar (kötü niyetli
  // kullanıcı sınırsız Opus multimodal çağrısı üretemesin). Son 24 saatte üretilen
  // değerlendirme sayısı eşiği aşarsa bu talep atlanır (akış yine bloke edilmez).
  const DAILY_QUOTA = 300
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await admin
    .from('ai_evaluation').select('id', { count: 'exact', head: true })
    .eq('tenant_id', request.tenant_id).gte('created_at', since)
  if ((recentCount ?? 0) >= DAILY_QUOTA) {
    return json({ ok: true, skipped: 'quota_exceeded' }, 200)
  }

  // İdempotenlik: başarılı değerlendirme varsa yeniden üretme — hem token
  // israfını hem de doktor geri bildiriminden SONRA içeriğin değişmesini önler.
  const { data: existing } = await admin
    .from('ai_evaluation').select('status').eq('request_id', request.id).maybeSingle()
  if (existing && existing.status !== 'failed') {
    return json({ ok: true, status: existing.status, cached: true }, 200)
  }

  // Hata ne olursa olsun failed kaydı yaz ve 200 dön (FR-11: çağıran beklemiyor).
  const writeFailed = async (msg: string) => {
    await admin.from('ai_evaluation').upsert({
      tenant_id: request.tenant_id, request_id: request.id,
      status: 'failed', warnings: [], suitability_note: null,
      disclaimer: DISCLAIMER, model: MODEL_ID, model_version: null,
      error: msg.slice(0, 500),
    }, { onConflict: 'request_id' }).then(() => {}, () => {})
    return json({ ok: false, status: 'failed' }, 200)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return await writeFailed('ANTHROPIC_API_KEY tanımlı değil')

  try {
    // Bağlam topla: operasyon adları + fotoğraflar + atanan doktor kartları + geri bildirim ipuçları.
    // Hasta adı bilerek çekilmiyor (gizlilik K3): AI bağlamı ada ihtiyaç duymaz.
    const [catRes, subRes, opRes, photosRes, assignRes] = await Promise.all([
      admin.from('category').select('name').eq('id', request.category_id).single(),
      request.subcategory_id
        ? admin.from('subcategory').select('name').eq('id', request.subcategory_id).single()
        : Promise.resolve({ data: null }),
      request.operation_type_id
        ? admin.from('operation_type').select('name').eq('id', request.operation_type_id).single()
        : Promise.resolve({ data: null }),
      admin.from('photo').select('storage_path, kind').eq('request_id', request.id).eq('layer', 'active'),
      admin.from('assignment').select('doctor_id').eq('request_id', request.id),
    ])

    const doctorIds = (assignRes.data ?? []).map((a: { doctor_id: string }) => a.doctor_id)
    const { data: doctorRows } = doctorIds.length > 0
      ? await admin.from('doctor').select('title, specialty, bio, weighted_work').in('id', doctorIds)
      : { data: [] }

    // Tenant bazlı öğrenme bağlamı (FR-53): son 20 geri bildirim, correct olmayanlar öncelikli.
    const { data: fbRows } = await admin
      .from('ai_feedback')
      .select('label, note, ai_evaluation:ai_evaluation_id(suitability_note)')
      .eq('tenant_id', request.tenant_id)
      .order('created_at', { ascending: false })
      .limit(20)
    const feedbackHints: FeedbackHint[] = (fbRows ?? [])
      .sort((a: { label: string }, b: { label: string }) =>
        (a.label === 'correct' ? 1 : 0) - (b.label === 'correct' ? 1 : 0))
      .map((f: { label: 'correct' | 'partial' | 'wrong'; note: string | null; ai_evaluation: { suitability_note: string | null } | null }) => ({
        label: f.label,
        note: f.note,
        summary: (f.ai_evaluation?.suitability_note ?? '').slice(0, 200) || 'değerlendirme özeti yok',
      }))

    // Fotoğraflara 300 sn imzalı URL — model URL'den görüntüyü çeker.
    const photoUrls: string[] = []
    const xrayUrls: string[] = []
    for (const p of photosRes.data ?? []) {
      const { data: signed } = await admin.storage.from('photos').createSignedUrl(p.storage_path, 300)
      if (!signed?.signedUrl) continue
      if (p.kind === 'xray') xrayUrls.push(signed.signedUrl)
      else photoUrls.push(signed.signedUrl)
    }

    const ctx: TriageContext = {
      patient: {
        age: request.age, heightCm: request.height_cm, weightKg: request.weight_kg,
        gender: request.gender,
        pastSurgeries: request.past_surgeries, knownConditions: request.known_conditions,
        medications: request.medications, notes: request.notes,
        smokingStatus: request.smoking_status, smokingPackYears: request.smoking_pack_years,
        alcoholStatus: request.alcohol_status, alcoholDrinksPerWeek: request.alcohol_drinks_per_week,
      },
      operation: {
        category: catRes.data?.name ?? 'bilinmiyor',
        subcategory: subRes.data?.name ?? null,
        operationType: opRes.data?.name ?? null,
      },
      doctors: (doctorRows ?? []).map((d: { title: string | null; specialty: string | null; bio: string | null; weighted_work: unknown }) => ({
        title: d.title, specialty: d.specialty, bio: d.bio, weightedWork: d.weighted_work,
      })),
      feedbackHints,
    }

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: buildSystemPrompt(),
      // deno-lint-ignore no-explicit-any
      messages: [{ role: 'user', content: buildUserContent(ctx, photoUrls, xrayUrls) as any }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''
    let parsedJson: unknown = null
    try { parsedJson = JSON.parse(rawText) } catch { parsedJson = null }
    const result = parseTriageOutput(parsedJson)
    if (!result) return await writeFailed('model çıktısı ayrıştırılamadı')

    const { error: upErr } = await admin.from('ai_evaluation').upsert({
      tenant_id: request.tenant_id, request_id: request.id,
      status: result.status, warnings: result.warnings,
      suitability_note: result.suitabilityNote,
      disclaimer: DISCLAIMER, model: MODEL_ID, model_version: response.model,
      error: null,
    }, { onConflict: 'request_id' })
    if (upErr) return await writeFailed(upErr.message)

    // Billing Faz 1: token kullanımı + USD maliyeti kaydı (best-effort, akışı bloklamaz).
    await recordUsage(admin, request.tenant_id, 'triage', request.id, MODEL_ID, response.usage)

    return json({ ok: true, status: result.status }, 200)
  } catch (e) {
    return await writeFailed(e instanceof Error ? e.message : String(e))
  }
})

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
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
  } catch { /* yut — maliyet kaydı asla akışı bozmaz */ }
}
