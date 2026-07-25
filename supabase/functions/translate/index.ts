import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

// Faz 3 — İçerik çevirisi (Task 2). Serbest metin çevirisi (hasta notu, doktor
// yanıtı vb.) — katalog adları name_i18n ile ayrı çözülür (Faz 2), bu fonksiyon
// onlara dokunmaz. Kimlik: kullanıcı JWT'si (verify_jwt=true) — yalnız kimliği
// doğrulanmış klinik personeli çağırabilir; rol kısıtı yok (herkes çeviri okuyabilir).
// content_translation'a yalnız service-role erişir (RLS: policy yok); kullanıcı
// token'ı burada SADECE kimlik doğrulamak için kullanılır, DB erişimi için değil.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL_ID = 'claude-sonnet-5'
const MAX_TEXT_LENGTH = 5000

// src/i18n/index.ts SUPPORTED ile birebir — katalog dışı serbest metin de aynı
// dil kümesiyle sınırlı (uygulamanın desteklediği tek diller).
const SUPPORTED_LANGS = new Set(['tr', 'ar', 'en'])

const LANG_NAMES: Record<string, string> = {
  tr: 'Türkçe',
  ar: 'Arapça',
  en: 'İngilizce',
}

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function buildSystemPrompt(sourceLang: string, targetLang: string): string {
  const source = LANG_NAMES[sourceLang] ?? sourceLang
  const target = LANG_NAMES[targetLang] ?? targetLang
  return (
    `Sen tıbbi/klinik metin çevirmenisin. Sana verilen metni ${source} dilinden ` +
    `${target} diline çevir. TIBBİ TERİMLERİ doğru ve tutarlı şekilde koru ` +
    `(ilaç adları, tanı/tedavi terimleri, ölçü birimleri). Ekstra açıklama, ` +
    `ön-söz veya not ekleme — YALNIZ çevrilmiş metni döndür.`
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  // Üst-düzey try/catch: erken aşamadaki (auth/DB/model) istisna da CORS başlıklı
  // JSON döner (aksi halde platform CORS'suz 500 döndürüp client'ta opak hata olur).
  try {
    if (req.method !== 'POST') return json({ error: 'method' }, 405)

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // JWT doğrula: yalnız kimliği doğrulanmış kullanıcı çağırabilir.
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userRes } = await caller.auth.getUser()
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
    const { data: me } = await caller.from('app_user').select('tenant_id').eq('id', userRes.user.id).single()
    if (!me) return json({ error: 'forbidden' }, 403)

    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'bad json' }, 400)
    const { text, source_lang: sourceLang, target_lang: targetLang } = body

    if (typeof text !== 'string') return json({ error: 'text required' }, 400)
    if (text.length > MAX_TEXT_LENGTH) return json({ error: 'text too long' }, 400)
    if (typeof sourceLang !== 'string' || !SUPPORTED_LANGS.has(sourceLang)) {
      return json({ error: 'invalid source_lang' }, 400)
    }
    if (typeof targetLang !== 'string' || !SUPPORTED_LANGS.has(targetLang)) {
      return json({ error: 'invalid target_lang' }, 400)
    }

    // Kısa devre: boş metin veya kaynak=hedef → Claude çağrısı yok.
    if (!text.trim() || sourceLang === targetLang) {
      return json({ translated: text, cached: true }, 200)
    }

    const admin = createClient(url, serviceKey)
    const sourceHash = await sha256Hex(text)

    // Önbellek: service-role ile (tenant_id, source_hash, target_lang) sorgula.
    // tenant_id filtresi: PHI çeviri önbelleği firma sınırları arasında SIZMASIN.
    const { data: existing } = await admin
      .from('content_translation')
      .select('translated_text')
      .eq('tenant_id', me.tenant_id)
      .eq('source_hash', sourceHash)
      .eq('target_lang', targetLang)
      .maybeSingle()
    if (existing) return json({ translated: existing.translated_text, cached: true }, 200)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY tanımlı değil' }, 500)

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 2000,
      system: buildSystemPrompt(sourceLang, targetLang),
      messages: [{ role: 'user', content: text }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const translated = textBlock && 'text' in textBlock ? textBlock.text.trim() : ''
    if (!translated) return json({ error: 'model çıktısı boş' }, 500)

    // Çakışmada yok say: aynı (tenant_id, source_hash, target_lang) için yarış
    // durumunda ilk yazan kazanır, ikinci istek hata almaz.
    await admin
      .from('content_translation')
      .upsert(
        { tenant_id: me.tenant_id, source_hash: sourceHash, source_lang: sourceLang, target_lang: targetLang, translated_text: translated },
        { onConflict: 'tenant_id,source_hash,target_lang', ignoreDuplicates: true },
      )
      .then(() => {}, () => {})

    return json({ translated, cached: false }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
