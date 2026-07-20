# Mükerrer Talep Denetimi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bir hastanın açık bir talebi varken gelen ikinci başvuruyu deterministik (telefon/isim) olarak yakalayıp doktora atamadan koordinatör denetim kuyruğuna yönlendirmek; Claude vision ile "aynı kişi mi" görsel önerisi sunmak; koordinatör onayla/reddet kararıyla talebi pasif almak ya da doktorlara salmak ve bu kararla AI'ı beslemek.

**Architecture:** Sunucu-taraflı `route_new_request` RPC yönlendirmeyi belirler (atama yerine geçer). Şüpheli talep `request.dup_state='pending'` olur, `duplicate_of_request_id` ile ana talebe bağlanır, atanmaz → doktor kuyruğunda görünmez. `duplicate-vision` edge fonksiyonu (onam kapılı, fire-and-forget) görsel karşılaştırma yazar. Koordinatör "Mükerrer Talep" ekranından `resolve_duplicate` RPC ile karar verir; karar `duplicate_feedback`'e (ok/not_ok) yazılır ve vision prompt'una few-shot beslenir.

**Tech Stack:** Supabase Postgres (RLS + SECURITY DEFINER RPC + enum), Deno edge function (Anthropic SDK, Claude vision), React 18 + Vite + TS + TanStack Query + Tailwind (Rafine Klinik token'ları), vitest (domain), Playwright (E2E).

## Global Constraints

- Yönlendirme kararı yalnız telefon/isim eşleşmesine dayanır — AI'a bağlı değildir. AI yalnız koordinatöre öneri sunar.
- `pending` talep için **assignment satırı oluşturulmaz** → doktor kuyruğu assignment-tabanlı olduğundan doktorlar görmez. Ek doktor-RLS gerekmez.
- Tüm `dup_state` / `duplicate_of_request_id` yazımları yalnız `security definer` RPC'lerden (`route_new_request`, `resolve_duplicate`) yapılır; istemciye doğrudan UPDATE verilmez.
- Görsel karşılaştırma yalnız `consent_at` dolu taleplerde çalışır (KVKK biyometrik). Onam yoksa AI atlanır (`ai_same=null`), koordinatör elle karar verir.
- Akış hiçbir noktada bloke olmaz (fire-and-forget; hata → 200).
- Tenant izolasyonu: her sorgu `current_tenant_id()` ile filtrelenir.
- Enum değerleri birebir: `dup_state('none','pending','confirmed','dismissed')`, `dup_fb_label('ok','not_ok')`.
- FR-21 sınırı korunur: doktor planları/AI değerlendirmeleri bu sürece hiç girmez; aracı (agent) mükerrer verisini göremez.
- Model: `claude-opus-4-8`, `thinking:{type:'adaptive'}`, JSON-schema structured output.
- Migrasyonlar canlı uygulanır (Supabase MCP `apply_migration`) ve doğrulama sorgularıyla test edilir — yerel DB yok. Yeni migration dosyası: `supabase/migrations/0028_duplicate_review.sql`.

---

### Task 1: Migration 0028 — şema (enum + kolon + tablolar + RLS)

**Files:**
- Create: `supabase/migrations/0028_duplicate_review.sql`

**Interfaces:**
- Produces: `dup_state` / `dup_fb_label` enum'ları; `request.duplicate_of_request_id`, `request.dup_state`; `duplicate_check`, `duplicate_feedback` tabloları; `tenant.dup_confidence_threshold`. Task 2/3/5/7 bunlara dayanır.

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- Mükerrer Talep Denetimi (spec 2026-07-20): açık talebi olan hastanın ikinci
-- başvurusu doktora gitmeden koordinatör kuyruğuna düşer; AI görsel önerisi +
-- koordinatör ok/not-ok geri bildirimi. Yönlendirme deterministik (telefon/isim).

create type dup_state as enum ('none','pending','confirmed','dismissed');
create type dup_fb_label as enum ('ok','not_ok');

alter table request
  add column duplicate_of_request_id uuid references request(id),
  add column dup_state dup_state not null default 'none';

create index request_dup_state_idx on request(tenant_id, dup_state) where dup_state <> 'none';

alter table tenant add column dup_confidence_threshold numeric not null default 0.75;

-- AI görsel karşılaştırma verdikti (ai_status mevcut enum: ok|warning|failed).
create table duplicate_check (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id),
  parent_request_id uuid not null references request(id),
  ai_same boolean,
  ai_confidence numeric,
  ai_reason text,
  status ai_status not null default 'ok',
  model text, model_version text, error text,
  created_at timestamptz not null default now(),
  unique (request_id)
);
alter table duplicate_check enable row level security;
-- Yalnız koordinatör/admin okur; aracı/satışçı/doktor göremez. Yazma service-role.
create policy dup_check_read on duplicate_check for select using (
  tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin')
);

-- Koordinatör kararı = ground-truth (ok=aynı kişi/onaylandı, not_ok=farklı/reddedildi).
create table duplicate_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id),
  duplicate_check_id uuid references duplicate_check(id),
  coordinator_label dup_fb_label not null,
  note text,
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  unique (request_id)
);
alter table duplicate_feedback enable row level security;
create policy dup_fb_read on duplicate_feedback for select using (
  tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin')
);
-- Yazma yok (resolve_duplicate RPC security definer içinden yazar).
```

- [ ] **Step 2: Migration'ı canlı uygula**

Supabase MCP `apply_migration` ile `name: 0028_duplicate_review`, `query: <yukarıdaki SQL>` uygula (proje ref `oxibdniwobetaksuxacs`).
Expected: hata yok.

- [ ] **Step 3: Şemayı doğrula**

`execute_sql` ile:
```sql
select column_name from information_schema.columns
where table_name='request' and column_name in ('dup_state','duplicate_of_request_id');
select unnest(enum_range(null::dup_state))::text;
select to_regclass('public.duplicate_check'), to_regclass('public.duplicate_feedback');
```
Expected: iki kolon; `none,pending,confirmed,dismissed`; iki tablo non-null.

- [ ] **Step 4: RLS'i doğrula (aracı okuyamaz)**

`get_advisors` (type `security`) çalıştır — yeni tablolarda RLS-disabled uyarısı OLMAMALI.
Expected: `duplicate_check`/`duplicate_feedback` için RLS uyarısı yok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0028_duplicate_review.sql
git commit -m "feat(dup): mükerrer denetim şeması (dup_state + check/feedback tabloları + RLS)"
```

---

### Task 2: `route_new_request` RPC — deterministik yönlendirme

**Files:**
- Modify: `supabase/migrations/0028_duplicate_review.sql` (aynı dosyaya ekle) veya yeni `0029_route_new_request.sql`. Bu planda **`0029_route_new_request.sql`** kullan (mantık ayrı kalsın).
- Create: `supabase/migrations/0029_route_new_request.sql`

**Interfaces:**
- Consumes: Task 1 şeması; mevcut `assign_request_doctors(uuid, assignment_type)`, `normalize_phone(text)`, `current_tenant_id()`, `current_role_name()`.
- Produces: `route_new_request(p_request_id uuid) returns jsonb` — Task 6 (client) bunu çağırır.

- [ ] **Step 1: RPC'yi yaz**

```sql
-- Yeni talebi yönlendir: hastanın AÇIK başka talebi telefon/isimle eşleşiyorsa
-- pending+parent yap (atama YOK); yoksa assign_request_doctors çalıştır.
create or replace function route_new_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_req record;
  v_np text;
  v_nm text;
  v_parent uuid;
  v_assigned int;
begin
  select r.*, p.first_name, p.last_name, p.phone
    into v_req
  from request r join patient p on p.id = r.patient_id
  where r.id = p_request_id and r.tenant_id = current_tenant_id();
  if v_req.id is null then raise exception 'talep bulunamadı'; end if;
  if not (v_req.created_by = auth.uid() or current_role_name() in ('coordinator','admin')) then
    raise exception 'yetki yok';
  end if;

  v_np := normalize_phone(v_req.phone);
  v_nm := trim(coalesce(v_req.first_name,'') || ' ' || coalesce(v_req.last_name,''));

  -- Aday: aynı tenant, FARKLI talep, AÇIK (status<>'closed'), confirmed olmayan,
  -- telefon (≥7 hane eşit) VEYA isim benzerliği>0.3. En son açık = ana talep.
  select r2.id into v_parent
  from request r2 join patient p2 on p2.id = r2.patient_id
  where r2.tenant_id = v_req.tenant_id
    and r2.id <> v_req.id
    and r2.status <> 'closed'
    and r2.dup_state <> 'confirmed'
    and (
      (length(v_np) >= 7 and normalize_phone(p2.phone) = v_np)
      or (v_nm <> '' and similarity(p2.first_name || ' ' || p2.last_name, v_nm) > 0.3)
    )
  order by r2.created_at desc
  limit 1;

  if v_parent is not null then
    update request set dup_state = 'pending', duplicate_of_request_id = v_parent
    where id = v_req.id;
    insert into audit_log (tenant_id, actor_id, action, entity, after)
    values (v_req.tenant_id, auth.uid(), 'request_dup_pending', 'request',
            jsonb_build_object('request_id', v_req.id, 'parent', v_parent));
    return jsonb_build_object('routed','coordinator','parentId', v_parent);
  end if;

  v_assigned := assign_request_doctors(v_req.id);
  return jsonb_build_object('routed','doctors','assignedCount', v_assigned);
end;
$$;
revoke execute on function route_new_request(uuid) from public, anon;
grant execute on function route_new_request(uuid) to authenticated;
```

- [ ] **Step 2: Migration'ı uygula**

Supabase MCP `apply_migration` `name: 0029_route_new_request`.
Expected: hata yok.

- [ ] **Step 3: Eşleşme YOK senaryosunu doğrula (normal atama)**

`execute_sql` ile benzersiz telefon/isimli bir test talebi oluştur (submitted, mevcut aktif doktor scope'una uyan kategori), sonra `select route_new_request('<id>')`.
Expected: `{"routed":"doctors","assignedCount":<n>}`, `request.dup_state='none'`, assignment satırı var.

- [ ] **Step 4: Eşleşme VAR senaryosunu doğrula (pending)**

Aynı telefonla ikinci bir talep+hasta oluştur (ilk talep açık), `select route_new_request('<id2>')`.
Expected: `{"routed":"coordinator","parentId":"<id1>"}`, `request.dup_state='pending'`, `duplicate_of_request_id=id1`, assignment satırı YOK.
Temizlik: test kayıtlarını sil.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0029_route_new_request.sql
git commit -m "feat(dup): route_new_request — deterministik pending/doktor yönlendirme"
```

---

### Task 3: `resolve_duplicate` RPC — koordinatör kararı + feedback

**Files:**
- Create: `supabase/migrations/0030_resolve_duplicate.sql`

**Interfaces:**
- Consumes: Task 1 şeması; `assign_request_doctors`; `current_role_name()`.
- Produces: `resolve_duplicate(p_request_id uuid, p_decision text, p_note text) returns jsonb` — Task 7 (client) çağırır.

- [ ] **Step 1: RPC'yi yaz**

```sql
-- Koordinatör mükerrer kararı: confirmed→pasif(closed), dismissed→doktorlara.
-- Karar duplicate_feedback'e ground-truth olarak yazılır (ok/not_ok).
create or replace function resolve_duplicate(p_request_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_req record;
  v_check uuid;
  v_label dup_fb_label;
  v_assigned int;
begin
  if current_role_name() not in ('coordinator','admin') then raise exception 'yetki yok'; end if;
  select * into v_req from request where id = p_request_id and tenant_id = current_tenant_id();
  if v_req.id is null then raise exception 'talep bulunamadı'; end if;
  if v_req.dup_state <> 'pending' then raise exception 'talep incelemede değil'; end if;
  if p_decision not in ('confirmed','dismissed') then raise exception 'geçersiz karar'; end if;

  select id into v_check from duplicate_check where request_id = v_req.id;

  if p_decision = 'confirmed' then
    update request set dup_state = 'confirmed', status = 'closed' where id = v_req.id;
    v_label := 'ok';
    insert into audit_log (tenant_id, actor_id, action, entity, after)
    values (v_req.tenant_id, auth.uid(), 'request_dup_confirmed', 'request',
            jsonb_build_object('request_id', v_req.id, 'parent', v_req.duplicate_of_request_id));
  else
    update request set dup_state = 'dismissed' where id = v_req.id;
    v_assigned := assign_request_doctors(v_req.id);
    v_label := 'not_ok';
    insert into audit_log (tenant_id, actor_id, action, entity, after)
    values (v_req.tenant_id, auth.uid(), 'request_dup_dismissed', 'request',
            jsonb_build_object('request_id', v_req.id, 'assigned', v_assigned));
  end if;

  insert into duplicate_feedback (tenant_id, request_id, duplicate_check_id, coordinator_label, note, decided_by)
  values (v_req.tenant_id, v_req.id, v_check, v_label, p_note, auth.uid())
  on conflict (request_id) do update set
    coordinator_label = excluded.coordinator_label, note = excluded.note,
    decided_by = excluded.decided_by, decided_at = now();

  return jsonb_build_object('decision', p_decision, 'label', v_label::text,
                            'assignedCount', coalesce(v_assigned, 0));
end;
$$;
revoke execute on function resolve_duplicate(uuid, text, text) from public, anon;
grant execute on function resolve_duplicate(uuid, text, text) to authenticated;
```

- [ ] **Step 2: Migration'ı uygula** — `apply_migration` `name: 0030_resolve_duplicate`. Expected: hata yok.

- [ ] **Step 3: confirmed senaryosunu doğrula**

Task 2 Step 4'teki pending talep üzerinde `select resolve_duplicate('<id2>','confirmed','test')`.
Expected: `dup_state='confirmed'`, `status='closed'`, `duplicate_feedback` satırı `coordinator_label='ok'`.

- [ ] **Step 4: dismissed senaryosunu doğrula**

Yeni bir pending talep hazırla, `select resolve_duplicate('<id3>','dismissed',null)`.
Expected: `dup_state='dismissed'`, assignment satırı oluştu, `duplicate_feedback` `not_ok`. Temizle.

- [ ] **Step 5: Yetki reddini doğrula**

Doktor JWT'siyle (veya rol simülasyonu) `resolve_duplicate` → hata `yetki yok`. (RLS/rol testi mevcut desenle.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0030_resolve_duplicate.sql
git commit -m "feat(dup): resolve_duplicate — koordinatör kararı + feedback"
```

---

### Task 4: Domain TS yardımcıları + birim testleri

**Files:**
- Create: `src/domain/duplicate.ts`
- Test: `src/domain/__tests__/duplicate.test.ts`

**Interfaces:**
- Produces: `dupStateLabel(s)`, `dupConfidenceClass(conf, threshold)`, `formatConfidencePct(conf)`, `matchReasonLabel(r)` — Task 7 (kart) kullanır.

- [ ] **Step 1: Başarısız testi yaz**

```ts
import { describe, it, expect } from 'vitest'
import { dupStateLabel, dupConfidenceClass, formatConfidencePct, matchReasonLabel } from '../duplicate'

describe('duplicate domain', () => {
  it('dup_state Türkçe etiketleri', () => {
    expect(dupStateLabel('pending')).toBe('İncelemede')
    expect(dupStateLabel('confirmed')).toBe('Mükerrer (pasif)')
    expect(dupStateLabel('dismissed')).toBe('Doktorlara gönderildi')
  })
  it('güven eşiği sınıfı', () => {
    expect(dupConfidenceClass(0.9, 0.75)).toBe('high')
    expect(dupConfidenceClass(0.5, 0.75)).toBe('low')
    expect(dupConfidenceClass(null, 0.75)).toBe('unknown')
  })
  it('güven yüzdesi biçimi', () => {
    expect(formatConfidencePct(0.87)).toBe('%87')
    expect(formatConfidencePct(null)).toBe('—')
  })
  it('eşleşme sebebi etiketi', () => {
    expect(matchReasonLabel('phone')).toBe('Telefon')
    expect(matchReasonLabel('name')).toBe('İsim')
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu gör** — `npx vitest run src/domain/__tests__/duplicate.test.ts`. Expected: FAIL (modül yok).

- [ ] **Step 3: Yardımcıları yaz**

```ts
export type DupState = 'none' | 'pending' | 'confirmed' | 'dismissed'

const STATE_LABELS: Record<DupState, string> = {
  none: 'Normal',
  pending: 'İncelemede',
  confirmed: 'Mükerrer (pasif)',
  dismissed: 'Doktorlara gönderildi',
}
export function dupStateLabel(s: DupState): string { return STATE_LABELS[s] }

export function dupConfidenceClass(conf: number | null, threshold: number): 'high' | 'low' | 'unknown' {
  if (conf == null) return 'unknown'
  return conf >= threshold ? 'high' : 'low'
}

export function formatConfidencePct(conf: number | null): string {
  if (conf == null) return '—'
  return `%${Math.round(conf * 100)}`
}

export function matchReasonLabel(r: 'phone' | 'name' | string): string {
  return r === 'phone' ? 'Telefon' : r === 'name' ? 'İsim' : r
}
```

- [ ] **Step 4: Testin geçtiğini gör** — `npx vitest run src/domain/__tests__/duplicate.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/duplicate.ts src/domain/__tests__/duplicate.test.ts
git commit -m "feat(dup): domain yardımcıları (durum/güven/sebep etiketleri) + testler"
```

---

### Task 5: `duplicate-vision` edge fonksiyonu

**Files:**
- Create: `supabase/functions/duplicate-vision/index.ts`
- Create: `supabase/functions/duplicate-vision/vision.ts`

**Interfaces:**
- Consumes: `duplicate_check`, `duplicate_feedback`, `request.duplicate_of_request_id`, `photo`, storage `photos`. Body `{ requestId }`.
- Produces: `duplicate_check` satırı. Task 6 (client) invoke eder.

- [ ] **Step 1: `vision.ts` (prompt + şema + parse)**

```ts
export const MODEL_ID = 'claude-opus-4-8'

export interface DupFeedbackHint { label: 'ok' | 'not_ok'; note: string | null }

export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    same: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string' },
  },
  required: ['same', 'confidence', 'reason'],
  additionalProperties: false,
} as const

export function buildSystemPrompt(): string {
  return [
    'Görevin: iki ayrı hasta başvurusuna ait fotoğraf gruplarının AYNI kişiye mi',
    'ait olduğunu değerlendirmek. Yalnızca kimlik/aynı-kişi eşleşmesi yap.',
    'ASLA teşhis, tedavi önerisi veya tıbbi yorum yapma. Çıktın yalnız koordinatöre',
    'yardımcı bir öneridir; nihai kararı insan verir. Emin değilsen düşük confidence ver.',
    'JSON şemasına uygun döndür: same (bool), confidence (0-1), reason (kısa).',
  ].join(' ')
}

export function buildUserContent(newUrls: string[], parentUrls: string[], hints: DupFeedbackHint[]) {
  const blocks: unknown[] = []
  blocks.push({ type: 'text', text: 'YENİ BAŞVURU fotoğrafları:' })
  for (const u of newUrls) blocks.push({ type: 'image', source: { type: 'url', url: u } })
  blocks.push({ type: 'text', text: 'ANA (ÖNCEKİ) BAŞVURU fotoğrafları:' })
  for (const u of parentUrls) blocks.push({ type: 'image', source: { type: 'url', url: u } })
  if (hints.length) {
    const lines = hints.map((h) => `- ${h.label === 'ok' ? 'AYNI kişiydi' : 'FARKLI kişiydi'}${h.note ? ' — ' + h.note : ''}`)
    blocks.push({ type: 'text', text: 'Koordinatörün geçmiş kararlarından örnekler (yön verici):\n' + lines.join('\n') })
  }
  return blocks
}

export interface VisionResult { same: boolean; confidence: number; reason: string }
export function parseVisionOutput(j: unknown): VisionResult | null {
  if (!j || typeof j !== 'object') return null
  const o = j as Record<string, unknown>
  if (typeof o.same !== 'boolean' || typeof o.confidence !== 'number' || typeof o.reason !== 'string') return null
  return { same: o.same, confidence: o.confidence, reason: o.reason }
}
```

- [ ] **Step 2: `index.ts` (ai-triage iskeleti; onam + kota + upsert)**

```ts
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
  if (!request.consent_at) { await writeCheck({ ai_same: null, status: 'ok', ai_reason: 'no_consent' }); return json({ ok: true, skipped: 'no_consent' }, 200) }

  // Günlük tenant kotası (maliyet).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin.from('duplicate_check').select('id', { count: 'exact', head: true })
    .eq('tenant_id', request.tenant_id).gte('created_at', since)
  if ((count ?? 0) >= 300) { await writeCheck({ ai_same: null, status: 'ok', ai_reason: 'quota' }); return json({ ok: true, skipped: 'quota' }, 200) }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) { await writeCheck({ ai_same: null, status: 'failed', error: 'no api key' }); return json({ ok: false }, 200) }

  try {
    const [newPhotos, parentPhotos, fbRows] = await Promise.all([
      admin.from('photo').select('storage_path').eq('request_id', request.id).eq('layer', 'active').is('deleted_at', null),
      admin.from('photo').select('storage_path').eq('request_id', request.duplicate_of_request_id).eq('layer', 'active').is('deleted_at', null),
      admin.from('duplicate_feedback').select('coordinator_label, note')
        .eq('tenant_id', request.tenant_id).order('decided_at', { ascending: false }).limit(10),
    ])
    const sign = async (rows: { storage_path: string }[]) => {
      const out: string[] = []
      for (const p of rows ?? []) {
        const { data } = await admin.storage.from('photos').createSignedUrl(p.storage_path, 300)
        if (data?.signedUrl) out.push(data.signedUrl)
      }
      return out
    }
    const [newUrls, parentUrls] = await Promise.all([sign(newPhotos.data ?? []), sign(parentPhotos.data ?? [])])
    if (!newUrls.length || !parentUrls.length) { await writeCheck({ ai_same: null, status: 'warning', ai_reason: 'yetersiz fotoğraf' }); return json({ ok: true, skipped: 'no_photos' }, 200) }

    const hints: DupFeedbackHint[] = (fbRows.data ?? []).map((f: { coordinator_label: 'ok'|'not_ok'; note: string|null }) => ({ label: f.coordinator_label, note: f.note }))

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
    if (!result) { await writeCheck({ ai_same: null, status: 'failed', error: 'parse' }); return json({ ok: false }, 200) }

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
```

- [ ] **Step 3: Deploy et** — Supabase MCP `deploy_edge_function` `name: duplicate-vision`, HER İKİ dosyayı da (`index.ts`, `vision.ts`) gönder.
Expected: deploy başarılı.

- [ ] **Step 4: Onamsız yolu doğrula**

Onamsız bir pending talep için `functions.invoke('duplicate-vision',{requestId})` (veya curl) → `duplicate_check` satırı `ai_same=null, ai_reason='no_consent'`.
Expected: satır yazıldı, 200.

- [ ] **Step 5: Onamlı yolu doğrula (gerçek fotoğraflı)**

Onamlı + fotoğraflı bir pending talep (Task 2 senaryosundan) için invoke → `duplicate_check` `ai_same` bool, `ai_confidence` sayı.
Expected: `status='ok'`, verdikt yazıldı.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/duplicate-vision/
git commit -m "feat(dup): duplicate-vision edge fn (onam kapılı görsel karşılaştırma + feedback few-shot)"
```

---

### Task 6: İstemci — oluşturma akışı yönlendirmesi + satışçı uyarısı

**Files:**
- Modify: `src/features/requests/useRequests.ts` (`useCreateRequest`)
- Modify: `src/features/requests/NewRequestWizard.tsx` (submit sonucu uyarısı)

**Interfaces:**
- Consumes: `route_new_request` RPC (Task 2), `duplicate-vision` fn (Task 5).
- Produces: `useCreateRequest` dönüşü `{ requestId, routed: 'coordinator'|'doctors', assignedCount, parentId? }` — wizard kullanır.

- [ ] **Step 1: `useCreateRequest` — assign yerine route**

`useRequests.ts` içinde (satır 64-76 bloğu) `assign_request_doctors` çağrısını `route_new_request` ile değiştir:

```ts
      // 4) Yönlendirme sunucuda: hastanın açık talebi varsa mükerrer-şüphesi
      // (pending, koordinatöre) — yoksa doktorlara atanır. (Mükerrer Talep Denetimi)
      const { data: routeRes, error: routeErr } = await supabase.rpc('route_new_request', {
        p_request_id: req.id,
      })
      if (routeErr) throw routeErr
      const routed = (routeRes as { routed: 'coordinator' | 'doctors'; assignedCount?: number; parentId?: string })
      // AI görsel karşılaştırma: yalnız pending + onam varsa fire-and-forget.
      if (routed.routed === 'coordinator' && input.consentGiven) {
        void supabase.functions.invoke('duplicate-vision', { body: { requestId: req.id } }).catch(() => {})
      }
      // Normal akışta AI ön-triyaj (mevcut davranış) yalnız doktorlara gidince.
      if (routed.routed === 'doctors' && input.consentGiven) {
        void supabase.functions.invoke('ai-triage', { body: { requestId: req.id } }).catch(() => {})
      }
      return {
        requestId: req.id as string,
        routed: routed.routed,
        assignedCount: routed.assignedCount ?? 0,
        parentId: routed.parentId,
      }
```

> Not: `ai-triage` artık yalnız doktora giden talepte tetiklenir (pending mükerrer talepte doktor triyajı anlamsız). Eski koşulsuz invoke satırı (73-75) kaldırılır.

- [ ] **Step 2: tsc** — `npx tsc --noEmit`. Expected: hata yok.

- [ ] **Step 3: Wizard submit sonucu uyarısı**

`NewRequestWizard.tsx` submit handler'ında (mevcut `assignedCount` uyarısını gösteren yer, ~satır 160) dönen `routed`'a göre:
- `routed==='coordinator'` ise başarı ekranında/toast: **"Bu hastanın aktif bir talebi var — kayıt koordinatör onayına gönderildi."** (mevcut `useToast` deseni; bloke etmez).
- `routed==='doctors'` ise mevcut "aktif doktor yok" uyarısı `assignedCount===0` iken korunur.

(Tam kod submit handler'ın mevcut yapısına göre; `const res = await createRequest.mutateAsync(...)` sonrası `if (res.routed==='coordinator') toast.show('Bu hastanın aktif bir talebi var — kayıt koordinatör onayına gönderildi.')`.)

- [ ] **Step 4: tsc + mevcut testler** — `npx tsc --noEmit && npx vitest run`. Expected: 153+ test yeşil, tsc temiz.

- [ ] **Step 5: Commit**

```bash
git add src/features/requests/useRequests.ts src/features/requests/NewRequestWizard.tsx
git commit -m "feat(dup): oluşturma akışı route_new_request'e geçti + satışçı mükerrer uyarısı"
```

---

### Task 7: Koordinatör "Mükerrer Talep" ekranı

**Files:**
- Create: `src/features/admin/useDuplicateQueue.ts`
- Create: `src/features/admin/DuplicateReview.tsx`
- Modify: `src/App.tsx` (rota `/admin/duplicates`)
- Modify: `src/lib/nav.ts` (koordinatör/admin nav link)
- Modify: `src/components/Layout.tsx` (NAV_ICONS ikonu)

**Interfaces:**
- Consumes: `resolve_duplicate` RPC (Task 3), `duplicate_check` (Task 1), `request.dup_state`/`duplicate_of_request_id`, Task 4 domain yardımcıları, `tenant.dup_confidence_threshold`.
- Produces: `useDuplicateQueue()`, `useResolveDuplicate()` hooks; `/admin/duplicates` rota.

- [ ] **Step 1: `useDuplicateQueue.ts` hook'ları**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { resolvePhotoUrls } from '../requests/photoUrl'
import type { PhotoRow } from '../../types/db'

export interface DuplicateItem {
  requestId: string
  createdAt: string
  patientName: string
  phone: string | null
  categoryName: string
  parentRequestId: string
  parentCreatedAt: string | null
  parentPatientName: string
  aiSame: boolean | null
  aiConfidence: number | null
  aiReason: string | null
  newPhotos: string[]
  parentPhotos: string[]
}

export function useDuplicateQueue() {
  return useQuery({
    queryKey: ['duplicate-queue'],
    queryFn: async (): Promise<DuplicateItem[]> => {
      const { data: reqs, error } = await supabase.from('request')
        .select('*').eq('dup_state', 'pending').order('created_at', { ascending: false })
      if (error) throw error
      const list = reqs as any[]
      if (!list.length) return []
      const parentIds = list.map((r) => r.duplicate_of_request_id).filter(Boolean)
      const reqIds = list.map((r) => r.id)
      const [{ data: parents }, { data: patients }, { data: cats }, { data: checks }, { data: photos }] = await Promise.all([
        supabase.from('request').select('id, created_at, patient_id').in('id', parentIds),
        supabase.from('patient').select('id, first_name, last_name, phone'),
        supabase.from('category').select('id, name'),
        supabase.from('duplicate_check').select('*').in('request_id', reqIds),
        supabase.from('photo').select('*').in('request_id', [...reqIds, ...parentIds]).is('deleted_at', null),
      ])
      const pmap = new Map((patients ?? []).map((p: any) => [p.id, p]))
      const cmap = new Map((cats ?? []).map((c: any) => [c.id, c.name]))
      const parentMap = new Map((parents ?? []).map((p: any) => [p.id, p]))
      const checkMap = new Map((checks ?? []).map((c: any) => [c.request_id, c]))
      const photosByReq = new Map<string, PhotoRow[]>()
      for (const ph of (photos ?? []) as PhotoRow[]) {
        const arr = photosByReq.get(ph.request_id) ?? []; arr.push(ph); photosByReq.set(ph.request_id, arr)
      }
      const signFor = async (id: string) => resolvePhotoUrls((photosByReq.get(id) ?? []).filter((p) => p.kind === 'photo'))
      const items: DuplicateItem[] = []
      for (const r of list) {
        const parent = parentMap.get(r.duplicate_of_request_id)
        const patient = pmap.get(r.patient_id)
        const parentPatient = parent ? pmap.get(parent.patient_id) : null
        const chk = checkMap.get(r.id)
        const [newPhotos, parentPhotos] = await Promise.all([
          signFor(r.id), parent ? signFor(parent.id) : Promise.resolve([]),
        ])
        items.push({
          requestId: r.id, createdAt: r.created_at,
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
          phone: patient?.phone ?? null, categoryName: cmap.get(r.category_id) ?? '—',
          parentRequestId: r.duplicate_of_request_id, parentCreatedAt: parent?.created_at ?? null,
          parentPatientName: parentPatient ? `${parentPatient.first_name} ${parentPatient.last_name}` : '—',
          aiSame: chk?.ai_same ?? null, aiConfidence: chk?.ai_confidence ?? null, aiReason: chk?.ai_reason ?? null,
          newPhotos: newPhotos.map((p) => p.url), parentPhotos: parentPhotos.map((p) => p.url),
        })
      }
      return items
    },
  })
}

export function useResolveDuplicate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { requestId: string; decision: 'confirmed' | 'dismissed'; note?: string }) => {
      const { error } = await supabase.rpc('resolve_duplicate', {
        p_request_id: input.requestId, p_decision: input.decision, p_note: input.note ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['duplicate-queue'] }); qc.invalidateQueries({ queryKey: ['requests'] }) },
  })
}
```

> `resolvePhotoUrls` dönüş tipini doğrula (`{ url }[]` bekleniyor); farklıysa `.map` uyarlanır (photoUrl.ts imzasına göre).

- [ ] **Step 2: `DuplicateReview.tsx` ekranı**

`PageHeader` + boş durum + her `DuplicateItem` için premium kart (Rafine Klinik token'ları, `Card`, lucide ikon, `dupStateLabel`/`formatConfidencePct`/`dupConfidenceClass`/`matchReasonLabel` domain yardımcıları). Kart:
- Sol: yeni talep (hasta/telefon/kategori/tarih) + `newPhotos` küçük görseller.
- Sağ: ana talep (`parentPatientName`, `parentCreatedAt`, kısa-id `parentRequestId.slice(0,8)`) + `parentPhotos`.
- AI şeridi: `aiSame` null → "onam yok / değerlendirilemedi"; değilse "Aynı kişi: %NN" (`formatConfidencePct`), eşik altı (`dupConfidenceClass==='low'`) uyarı tinti + `aiReason`.
- İki buton: **"Mükerrer — pasife al"** → `resolve({decision:'confirmed'})`; **"Mükerrer değil — doktorlara gönder"** → `resolve({decision:'dismissed'})`. Opsiyonel not `<textarea>`. `useToast` ile sonuç.

Tenant eşiği için `useTenantPhotoSettings` benzeri küçük hook veya `tenant.dup_confidence_threshold`'ı queue ile birlikte çek (varsayılan 0.75).

- [ ] **Step 3: Rota + nav + ikon**

`App.tsx`:
```tsx
<Route path="/admin/duplicates" element={<Protected><Layout><RoleGate allow={['coordinator','admin']}><DuplicateReview /></RoleGate></Layout></Protected>} />
```
`nav.ts` coordinator/admin dizisine `{ to: '/admin/duplicates', label: 'Mükerrer Talep' }`.
`Layout.tsx` NAV_ICONS'a `'/admin/duplicates': CopyCheck` (lucide `CopyCheck` import).

- [ ] **Step 4: tsc + testler** — `npx tsc --noEmit && npx vitest run`. Expected: tsc temiz, testler yeşil.

- [ ] **Step 5: Canlı görsel doğrulama (Playwright, iki tema)**

Koordinatörle `/admin/duplicates`'e gidip pending bir talebin kartını açık+koyu temada ekran görüntüsüyle doğrula (mevcut geçici-test deseni; sonra sil).

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/useDuplicateQueue.ts src/features/admin/DuplicateReview.tsx src/App.tsx src/lib/nav.ts src/components/Layout.tsx
git commit -m "feat(dup): koordinatör Mükerrer Talep ekranı (kuyruk + karar + AI önerisi)"
```

---

### Task 8: E2E + RLS doğrulama + build

**Files:**
- Test: `tests/e2e/duplicate-flow.spec.ts` (kalıcı E2E)

**Interfaces:**
- Consumes: tüm önceki task'lar.

- [ ] **Step 1: E2E testi yaz**

Satışçı benzersiz hastayla talep girer → doktor kuyruğunda görünür (kontrol). Sonra AYNI telefon/isimle 2. talep girer → satışçı "aktif talep var" uyarısını görür; koordinatör `/admin/duplicates`'te kaydı görür; doktor kuyruğunda 2. talep GÖRÜNMEZ. Koordinatör "doktorlara gönder" → doktor kuyruğunda görünür. (Mevcut `core-flow.spec.ts` login helper'ını yeniden kullan.)

- [ ] **Step 2: E2E'yi çalıştır** — `npx playwright test tests/e2e/duplicate-flow.spec.ts`. Expected: PASS.

- [ ] **Step 3: RLS doğrulama**

`execute_sql`/rol simülasyonu: aracı JWT'siyle `select * from duplicate_check` → 0 satır / policy reddi; doktor da göremez.
Expected: yalnız koordinatör/admin okur.

- [ ] **Step 4: Tam doğrulama** — `npx tsc --noEmit && npx vitest run && npm run build`. Expected: hepsi yeşil.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/duplicate-flow.spec.ts
git commit -m "test(dup): mükerrer akışı E2E (satışçı→koordinatör→doktor) + RLS doğrulama"
```

---

## Deploy & Kapanış (plan sonrası)

- `npm run deploy` (web build + wrangler).
- Edge fn zaten Task 5'te deploy edildi.
- `finishing-a-development-branch`: testler yeşilse `feature/mukerrer-talep` → main merge; kullanıcı `git push origin main` (push oturumda bloklu).
- Bellek güncelle: mükerrer denetim milestone'u.

## Self-Review Notu

- **Spec kapsaması:** §5 şema→T1; §7.1→T2; §7.2→T3; §8→T5; §9.1-9.2→T6; §9.3-9.4→T7; §11 testler→T4/T8. §10 (mobil değişiklik yok) — task gerektirmez (kapsam dışı, doğru).
- **Tip tutarlılığı:** `route_new_request` dönüşü `{routed, assignedCount?, parentId?}` T2/T6 aynı; `resolve_duplicate` `{decision,label,assignedCount}` T3/T7 aynı; `dup_state`/`dup_fb_label` enum değerleri her yerde birebir.
- **Açık nokta:** `resolvePhotoUrls` dönüş şekli (`{url}[]`) T7 Step 1'de doğrulanacak; farklıysa map uyarlanır.
