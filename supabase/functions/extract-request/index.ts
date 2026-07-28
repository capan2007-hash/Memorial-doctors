import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

// "Yapıştır ve doldur": satışçının WhatsApp'tan aldığı SERBEST hasta metnini
// (herhangi bir dilde) yapılandırılmış talep alanlarına çıkarır. Çıktı yalnız
// TASLAK'tır — satışçı kontrol edip düzeltir, otomatik kayıt YAPILMAZ.
//
// GİZLİLİK NOTU: Bu fonksiyon, diğer AI uçlarının aksine hasta ADINI ve TELEFONUNU
// bilerek LLM'e gönderir — çıkarımın amacı zaten bu alanları doldurmaktır, bu yüzden
// scrubPii/redactNames UYGULANMAZ. Koruma: istemci bu ucu YALNIZ hastanın açık
// rızası (onam kutusu) işaretliyken çağırır + verify_jwt (kimliği doğrulanmış
// klinik personeli) + tenant kapsamı. Hiçbir veri saklanmaz (yalnız yanıt döner).
//
// Dil: hasta metni herhangi bir dilde olabilir (AR/RU/EN/DE/FR/TR...). Model metni
// anlar ve SERBEST METİN alanlarını `target_lang` (satışçının arayüz dili) ile üretir.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL_ID = 'claude-sonnet-5'
const MAX_TEXT_LENGTH = 8000

const SUPPORTED_LANGS = new Set(['tr', 'ar', 'en', 'ru', 'de', 'fr'])
const LANG_NAMES: Record<string, string> = {
  tr: 'Türkçe', ar: 'Arapça', en: 'İngilizce', ru: 'Rusça', de: 'Almanca', fr: 'Fransızca',
}

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ŞEMA NOTU: Anthropic json_schema'da (a) enum + null union'ı reddedilir, (b) union
// tipli parametre sayısı 16 ile sınırlıdır. Bu yüzden TÜM alanlar düz `string`;
// "bilgi yok" = BOŞ STRING. Sayısal/enum dönüşümü + doğrulama SUNUCUDA yapılır
// (aşağıda normalize) → istemci temiz, tipli veri alır.
const STR = { type: 'string' }
const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    firstName: STR,
    lastName: STR,
    phone: STR,
    birthDate: { type: 'string', description: 'YYYY-MM-DD; metinde doğum tarihi yoksa boş string' },
    age: { type: 'string', description: 'Yalnız rakam (örn. "54"); yoksa boş string' },
    heightCm: { type: 'string', description: 'cm, yalnız rakam; yoksa boş string' },
    weightKg: { type: 'string', description: 'kg, yalnız rakam; yoksa boş string' },
    pastSurgeries: STR,
    knownConditions: STR,
    medications: STR,
    smokingStatus: { type: 'string', description: 'never | former | current; bilinmiyorsa boş string' },
    smokingCigsPerDay: { type: 'string', description: 'yalnız rakam; yoksa boş string' },
    smokingYears: { type: 'string', description: 'yalnız rakam; yoksa boş string' },
    alcoholStatus: { type: 'string', description: 'never | occasional | regular; bilinmiyorsa boş string' },
    alcoholDrinksPerWeek: { type: 'string', description: 'yalnız rakam; yoksa boş string' },
    categoryId: STR,
    subcategoryId: STR,
    subcategoryIds: {
      type: 'string',
      description:
        'Hastanın istediği TÜM işlemlerin alt kategori idleri, virgülle ayrılmış (örn. "id1,id2"). Tek işlem varsa tek id. Yoksa boş string.',
    },
    operationTypeId: STR,
    notes: STR,
  },
  required: [
    'firstName', 'lastName', 'phone', 'birthDate', 'age', 'heightCm', 'weightKg',
    'pastSurgeries', 'knownConditions', 'medications',
    'smokingStatus', 'smokingCigsPerDay', 'smokingYears',
    'alcoholStatus', 'alcoholDrinksPerWeek',
    'categoryId', 'subcategoryId', 'subcategoryIds', 'operationTypeId', 'notes',
  ],
  additionalProperties: false,
}

function buildSystemPrompt(targetLang: string, catalog: unknown): string {
  const target = LANG_NAMES[targetLang] ?? targetLang
  return [
    'Sen bir estetik cerrahi kliniğinin hasta-kayıt asistanısın. Sana satış temsilcisinin',
    'hastadan (genellikle WhatsApp üzerinden) aldığı SERBEST METİN verilir.',
    '',
    'GÖREV: Metinden hasta talebi alanlarını çıkar ve verilen şemaya uygun JSON üret.',
    '',
    'DİL: Girdi metni HERHANGİ bir dilde olabilir (Türkçe, Arapça, Rusça, İngilizce, Almanca,',
    `Fransızca...). Metni o dilde anla; ancak SERBEST METİN alanlarını (pastSurgeries,`,
    `knownConditions, medications, notes) MUTLAKA ${target} dilinde yaz. Hasta ADI ve SOYADI`,
    'ise ÇEVRİLMEZ/TRANSLİTERE EDİLMEZ — metinde yazıldığı gibi bırakılır.',
    '',
    'KURALLAR:',
    '- Metinde OLMAYAN bilgiyi UYDURMA. Bilgi yoksa ilgili alana BOŞ STRING ("") yaz.',
    '- TÜM alanlar string tipindedir; sayısal alanlara yalnız rakam yaz (örn. "170").',
    '- CİNSİYET ÇIKARIMI YAPMA (şemada yok) — isimden cinsiyet tahmin etmek hatalıdır.',
    '- Yaş: metinde açıkça yaş varsa `age`; doğum tarihi varsa `birthDate` (YYYY-MM-DD).',
    '  İkisi de varsa ikisini de doldur. Yaşı KENDİN HESAPLAMA — tarihi olduğu gibi ver.',
    '- Tıbbi alanlar: "Alerji: Yok", "İlaç kullanmıyor" gibi ifadeler olumsuzlamadır →',
    `  ilgili alana ${target} dilinde "yok" anlamına gelen kısa ifade yaz.`,
    '- Sigara/alkol: yalnız metinde belirtilmişse doldur (never/former/current,',
    '  never/occasional/regular). Miktar belirtilmemişse sayı alanları boş string.',
    '- Telefon: metinde varsa olduğu gibi ver, yoksa boş string.',
    '- "null" KELİMESİNİ ASLA YAZMA — bilgi yoksa boş string ("") kullan.',
    '',
    'OPERASYON EŞLEŞTİRME: Aşağıda kliniğin katalog ağacı JSON olarak verilmiştir.',
    'Hastanın istediği işleme EN UYGUN düğümü seç ve id değerlerini döndür',
    '(categoryId zorunlu değil ama bulabiliyorsan doldur; subcategoryId/operationTypeId',
    'yalnız seçtiğin kategoriye ait olmalıdır). Emin değilsen boş string bırak.',
    '',
    'ÇOKLU İŞLEM: Hasta birden fazla işlem isteyebilir (ör. "BBL + 360 lipo + meme dikleştirme").',
    'TEK bir kategori seç (işlemlerin ait olduğu ana kategori) ve istenen TÜM işlemlerin alt',
    'kategori idlerini `subcategoryIds` alanına VİRGÜLLE AYIRARAK yaz. `subcategoryId` alanına',
    'bunlardan birincil/en kapsamlı olanı yaz (geriye dönük uyumluluk için).',
    'İşlemler farklı kategorilere düşüyorsa hastanın ASIL vurguladığı kategoriyi seç; kataloğa',
    `eşleşmeyen istekleri \`notes\` alanına ${target} dilinde yaz (örn. "Ek talepler: ...").`,
    'Hastanın kendi ifadelerinden önemli ayrıntıları da notes\'a ekle.',
    '',
    'KATALOG:',
    JSON.stringify(catalog),
  ].join('\n')
}

// Billing: çıkarım çağrısının token+maliyetini ai_usage'a yazar (best-effort).
// deno-lint-ignore no-explicit-any
async function recordUsage(admin: any, tenantId: string, model: string, usage: any) {
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
      tenant_id: tenantId, service: 'extraction', request_id: null, model,
      input_tokens: inTok, output_tokens: outTok, cache_write_tokens: cacheW, cache_read_tokens: cacheR,
      cost_usd: cost,
    })
  } catch { /* yut */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method !== 'POST') return json({ error: 'method' }, 405)

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userRes } = await caller.auth.getUser()
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
    const { data: me } = await caller.from('app_user').select('tenant_id, role').eq('id', userRes.user.id).single()
    if (!me) return json({ error: 'forbidden' }, 403)
    // Talep oluşturabilen roller (wizard'ı kullananlar) + yöneticiler.
    if (!['sales', 'agent', 'coordinator', 'admin', 'super_admin'].includes(me.role)) {
      return json({ error: 'forbidden' }, 403)
    }

    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'bad json' }, 400)
    const text: unknown = body.text
    const targetLang: unknown = body.target_lang

    if (typeof text !== 'string' || !text.trim()) return json({ error: 'text required' }, 400)
    if (text.length > MAX_TEXT_LENGTH) return json({ error: 'text too long' }, 400)
    if (typeof targetLang !== 'string' || !SUPPORTED_LANGS.has(targetLang)) {
      return json({ error: 'invalid target_lang' }, 400)
    }

    const admin = createClient(url, serviceKey)

    // Katalog ağacı (tenant kapsamlı) — model buradan id seçer.
    // NOT: tenant_id YALNIZ category'de var; subcategory/operation_type kategori
    // üzerinden kapsanır (bu yüzden önce kategoriler, sonra id'lerine göre süzme).
    const { data: cats } = await admin
      .from('category').select('id, name, has_subcategories').eq('tenant_id', me.tenant_id)
    const catIdList = (cats ?? []).map((c: { id: string }) => c.id)
    const [{ data: subs }, { data: opsRows }] = catIdList.length
      ? await Promise.all([
          admin.from('subcategory').select('id, category_id, name').in('category_id', catIdList),
          admin.from('operation_type').select('id, category_id, subcategory_id, name').in('category_id', catIdList),
        ])
      : [{ data: [] }, { data: [] }]
    const catalog = {
      categories: cats ?? [],
      subcategories: subs ?? [],
      operationTypes: opsRows ?? [],
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY tanımlı değil' }, 500)

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 2000,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: buildSystemPrompt(targetLang, catalog),
      messages: [{ role: 'user', content: text }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const raw = textBlock && 'text' in textBlock ? textBlock.text : ''
    let parsed: Record<string, unknown> | null = null
    try { parsed = JSON.parse(raw) } catch { parsed = null }
    if (!parsed) return json({ error: 'model çıktısı ayrıştırılamadı' }, 500)

    await recordUsage(admin, me.tenant_id, MODEL_ID, response.usage)

    // Normalize: modelin düz-string çıktısını tipli/doğrulanmış veriye çevir.
    const str = (v: unknown): string | null => {
      const s = typeof v === 'string' ? v.trim() : ''
      return s || null
    }
    const num = (v: unknown): number | null => {
      const s = typeof v === 'string' ? v.replace(',', '.').trim() : ''
      if (!s) return null
      const n = Number(s.replace(/[^0-9.]/g, ''))
      return Number.isFinite(n) && n > 0 ? n : null
    }
    const oneOf = (v: unknown, allowed: string[]): string | null => {
      const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
      return allowed.includes(s) ? s : null
    }

    // Katalog id doğrulaması: model uydurursa istemciye geçersiz id gitmesin.
    const catIds = new Set((cats ?? []).map((c: { id: string }) => c.id))
    const subIds = new Set((subs ?? []).map((s: { id: string }) => s.id))
    const opIds = new Set((opsRows ?? []).map((o: { id: string }) => o.id))
    const validId = (v: unknown, set: Set<string>): string | null =>
      typeof v === 'string' && set.has(v) ? v : null
    // null'ları at, sırayı koru, tekrarları sil.
    const dedupeIds = (ids: (string | null)[]): string[] =>
      Array.from(new Set(ids.filter((x): x is string => !!x)))

    // Yaş: doğum tarihi varsa KODDA hesaplanır (model aritmetik yapmaz).
    const birthDate = str(parsed.birthDate)
    let age = num(parsed.age)
    if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      const b = new Date(birthDate)
      if (!Number.isNaN(b.getTime())) {
        const now = new Date()
        let a = now.getUTCFullYear() - b.getUTCFullYear()
        const m = now.getUTCMonth() - b.getUTCMonth()
        if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) a--
        if (a > 0 && a < 130) age = a
      }
    }

    const extracted = {
      firstName: str(parsed.firstName),
      lastName: str(parsed.lastName),
      phone: str(parsed.phone),
      birthDate,
      age,
      heightCm: num(parsed.heightCm),
      weightKg: num(parsed.weightKg),
      pastSurgeries: str(parsed.pastSurgeries),
      knownConditions: str(parsed.knownConditions),
      medications: str(parsed.medications),
      smokingStatus: oneOf(parsed.smokingStatus, ['never', 'former', 'current']),
      smokingCigsPerDay: num(parsed.smokingCigsPerDay),
      smokingYears: num(parsed.smokingYears),
      alcoholStatus: oneOf(parsed.alcoholStatus, ['never', 'occasional', 'regular']),
      alcoholDrinksPerWeek: num(parsed.alcoholDrinksPerWeek),
      categoryId: validId(parsed.categoryId, catIds),
      subcategoryId: validId(parsed.subcategoryId, subIds),
      // Katalog v2 çoklu işlem: virgüllü liste → doğrulanmış id dizisi (tekilleştirilmiş).
      // Birincil (subcategoryId) listede yoksa başa eklenir; böylece istemci tek kaynaktan okur.
      subcategoryIds: dedupeIds([
        validId(parsed.subcategoryId, subIds),
        ...String(parsed.subcategoryIds ?? '')
          .split(',')
          .map((s) => validId(s.trim(), subIds)),
      ]),
      operationTypeId: validId(parsed.operationTypeId, opIds),
      notes: str(parsed.notes),
    }

    return json({ extracted }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
