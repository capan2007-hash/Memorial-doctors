# MedTriage M2 — AI Dahili Triyaj + Geri Besleme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Talep gönderilince arka planda Claude Opus 4.8 ile (foto + demografi + tıbbi bilgi + doktor kartı bağlamı) dahili triyaj değerlendirmesi üretmek; doktor/satışçı/koordinatöre uyarılar + "hangi işlemler uygun" yorumu göstermek (aracıya asla); doktorun doğru/kısmen/yanlış geri bildirimiyle tenant-scoped öğrenme döngüsü kurmak.

**Architecture:** Supabase Edge Function `ai-triage` (Deno, service-role; `ANTHROPIC_API_KEY` Supabase secret) — client talep oluşturduktan sonra fire-and-forget invoke eder (FR-11: AI bloke etmez). Fonksiyon bağlamı toplar → Claude (vision, adaptive thinking, `output_config.format` json_schema) → `ai_evaluation` upsert. Saf prompt/parse mantığı `triage.ts`'te (vitest ile test edilir). Geri bildirim `ai_feedback`; son N 'wrong/partial' kayıt sonraki prompt'a bağlam olur (FR-53).

**Tech Stack:** Mevcut + Edge Function içinde `npm:@anthropic-ai/sdk`. Model: `claude-opus-4-8` (tek sabit, `MODEL_ID`).

## Global Constraints

- FR-8/sapma-2: `ai_evaluation`/`ai_feedback` doktor+satışçı+koordinatör/admin okur; **agent HİÇ okuyamaz** (RLS'te agent policy yok — response deseni). Hastaya asla.
- FR-10: her değerlendirmede zorunlu disclaimer + model/model_version loglanır. FR-9: yorum yön göstericidir, bağlayıcı değildir (UI'da da böyle sunulur).
- FR-11: AI hatası/yokluğu talep akışını DURDURMAZ; invoke fire-and-forget, hata yutulur; `status='failed'` yazılır.
- §10.4 katı sınırlar system prompt'ta: teşhis/reçete/onay-red/hastaya mesaj YOK.
- Anahtar client'a asla inmez (yalnız edge secret). Arayüz Türkçe; kod İngilizce; commit Türkçe conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- E2E assertion'ları zayıflatılmaz; mevcut akış bozulmaz.

---

## Task 1: Migration 0010 — ai_evaluation + ai_feedback + RLS

**Files:** Create `supabase/migrations/0010_ai_triage.sql` (controller MCP ile uygular)

```sql
create type ai_status as enum ('ok','warning','failed');
create type ai_feedback_label as enum ('correct','partial','wrong');

create table ai_evaluation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  status ai_status not null,
  warnings jsonb not null default '[]',
  suitability_note text,
  disclaimer text not null,
  model text not null,
  model_version text,
  error text,
  created_at timestamptz not null default now(),
  unique (request_id)
);
create index on ai_evaluation (tenant_id, request_id);

create table ai_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  ai_evaluation_id uuid not null references ai_evaluation(id) on delete cascade,
  doctor_id uuid not null references doctor(id),
  label ai_feedback_label not null,
  note text,
  created_at timestamptz not null default now(),
  unique (ai_evaluation_id, doctor_id)
);
create index on ai_feedback (tenant_id, created_at desc);

alter table ai_evaluation enable row level security;
alter table ai_feedback enable row level security;

-- Okuma: doktor (kendisine atanan talep) + sales + coordinator/admin. AGENT YOK.
create policy ai_eval_read on ai_evaluation for select using (
  tenant_id = current_tenant_id() and (
    current_role_name() in ('sales','coordinator','admin')
    or request_id in (select request_id from assignment where doctor_id = current_doctor_id())
  )
);
-- Yazma: yalnız service role (policy YOK → client insert edemez; service role RLS bypass eder).

create policy ai_fb_doctor_insert on ai_feedback for insert with check (
  tenant_id = current_tenant_id() and doctor_id = current_doctor_id()
  and current_role_name() = 'doctor'
);
create policy ai_fb_read on ai_feedback for select using (
  tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator','admin') or doctor_id = current_doctor_id()
  )
);
```

- [ ] Uygula (`apply_migration`), doğrula (`list_tables` + advisors: yeni tablolar RLS'li), commit `feat: ai_evaluation + ai_feedback şeması ve RLS`.

## Task 2: Saf triyaj mantığı `supabase/functions/ai-triage/triage.ts` (TDD, vitest)

**Files:** Create `supabase/functions/ai-triage/triage.ts` + `src/domain/__tests__/triage.test.ts` (vitest, dosyayı göreli import eder — Deno'ya özgü import KULLANMA; saf TS)

**Interfaces (Produces):**
```ts
export const MODEL_ID = 'claude-opus-4-8'
export const DISCLAIMER = 'Bu değerlendirme yalnızca dahili triyaj amaçlıdır; teşhis veya tedavi kararı değildir. Nihai tıbbi görüş hekime aittir.'
export const WARNING_TYPES = ['photo_operation_mismatch','demographics_operation_risk','missing_data','photo_quality'] as const
export interface TriageContext { patient: {...ad, yaş, boy, kilo, cinsiyet, tıbbi 3 alan, not}, operation: {category, subcategory?, operationType?},
  doctors: { title, specialty, bio, weightedWork }[], feedbackHints: { label, note, summary }[] }
export function buildSystemPrompt(): string           // §10.4 katı sınırlar + rol tanımı + Türkçe çıktı talimatı
export function buildUserContent(ctx: TriageContext, photoUrls: string[], xrayUrls: string[]): unknown[]  // image url blokları + yapılandırılmış metin
export const OUTPUT_SCHEMA: object                    // json_schema: { status:'ok'|'warning', warnings:[{type(enum),confidence(0..1),rationale}], suitability_note:string }
export function parseTriageOutput(raw: unknown): { status:'ok'|'warning'; warnings: {type,confidence,rationale}[]; suitabilityNote: string } | null
                                                      // şema dışı/geçersiz tip → null (çağıran 'failed' yazar); geçersiz warning type'ları filtreler
```
- buildSystemPrompt zorunlu içerik: "teşhis koymazsın, tedavi reçete etmezsin, operasyon onayı/reddi vermezsin, hastaya mesaj üretmezsin; çıktın yalnız hekime yönelik dahili karar desteğidir"; suitability_note için: "hastanın talebi, demografisi, tıbbi geçmişi ve fotoğraflara göre hangi işlemlerin uygun görünebileceğini ve dikkat edilmesi gerekenleri kısa, yön gösterici Türkçe metinle açıkla".
- [ ] Testler (RED→GREEN): parse geçerli örnek; geçersiz JSON→null; bilinmeyen warning type filtrelenir; confidence sınır dışı (>1) clamp/filtre; buildUserContent foto URL'lerini image bloklarına, röntgenleri ayrı işaretle; buildSystemPrompt yasak ifadeleri içerir (('teşhis') içerir gibi metin assert'leri).
- [ ] Commit `feat: ai-triage saf prompt/parse mantığı`.

## Task 3: Edge Function `ai-triage/index.ts` (controller deploy)

**Files:** Create `supabase/functions/ai-triage/index.ts`

Akış: (JWT'li çağıran doğrulanır — herhangi bir authenticated tenant kullanıcısı tetikleyebilir; requestId body'den) →
service role ile: request+patient+category/subcategory/operation_type+photos çek → foto imzalı URL'ler (300sn) →
atanan doktorların kartları (assignment→doctor: title/specialty/bio/weighted_work) →
son N=20 `ai_feedback` (label != 'correct' öncelikli; note'lu) tenant bazında `feedbackHints` →
Anthropic çağrısı: `MODEL_ID`, `max_tokens: 4096`, `thinking:{type:'adaptive'}`, `output_config:{format:{type:'json_schema', schema: OUTPUT_SCHEMA}}`, system=buildSystemPrompt(), user=buildUserContent(...) →
parseTriageOutput → `ai_evaluation` upsert (`onConflict: request_id`): ok/warning + warnings + suitability_note + DISCLAIMER + model/model_version(`response.model`) →
herhangi bir hatada upsert `status='failed', error=<mesaj>` (yine DISCLAIMER + model yazılır) ve 200 döner (FR-11: çağıran zaten beklemiyor).
CORS başlıkları (create-doctor deseni). `ANTHROPIC_API_KEY` yoksa → failed kaydı ('anahtar tanımlı değil').
- [ ] Deploy (controller `deploy_edge_function`, verify_jwt=true), canlı smoke (controller): gerçek talep id ile invoke → ai_evaluation satırı oluşur.
- [ ] Commit `feat: ai-triage Edge Function (Claude Opus 4.8 dahili triyaj)`.

## Task 4: Client tetikleme + tipler + hook'lar

**Files:** Modify `src/types/db.ts` (`AiEvaluationRow`, `AiFeedbackRow`), `src/features/requests/useRequests.ts` (create başarısında fire-and-forget invoke); Create `src/features/ai/useAiEvaluation.ts`, `src/features/ai/useAiFeedback.ts`

- `useCreateRequest` başarı yolunda (assignment sonrası): `void supabase.functions.invoke('ai-triage', { body: { requestId: req.id } }).catch(() => {})` — await ETME (FR-11).
- `useAiEvaluation(requestId)`: `ai_evaluation` tek satır (maybeSingle; agent'a RLS boş döndürür → null) + 20sn'de bir refetch `refetchInterval: (q) => q.state.data ? false : 5000` deseniyle sonuç gelene dek kısa poll (max ~2dk: `refetchInterval` fonksiyonu dataUpdatedAt'e göre keser) — basit tutulabilir: data yokken 5sn poll, gelince durur.
- `useSubmitAiFeedback()`: insert {tenant_id, request_id, ai_evaluation_id, doctor_id, label, note} + `['ai-eval', requestId]` invalidate; hata toast.
- [ ] tsc/build/testler temiz; commit `feat: ai-triage client tetikleme + hook'lar`.

## Task 5: UI — AiPanel (doktor + satışçı + koordinatör) & geri bildirim

**Files:** Create `src/features/ai/AiPanel.tsx`; Modify `src/features/doctor/DoctorRequestView.tsx` (placeholder yerine), `src/features/requests/RequestDetail.tsx` (RoleGate sales/coordinator/admin İÇİNDE — agent'a render edilmez; RLS zaten boş döndürür)

`AiPanel({ requestId, canGiveFeedback, doctorId? })`:
- Yükleniyor/`null`: küçük satır "AI değerlendirmesi hazırlanıyor…" (Spinner) — poll sürerken; hiç gelmezse sessizce gizlenir (dataUpdatedAt sonrası).
- `failed`: soluk satır "AI değerlendirmesi yapılamadı" (+ hata gösterilmez).
- ok/warning: `Card title="AI Triyaj Değerlendirmesi"` — üstte küçük `bg-accent-100` bilgi bandı: **"Yön göstericidir; nihai karar hekimindir."** (DISCLAIMER); uyarılar listesi: tip etiketi Türkçe haritayla (Fotoğraf-operasyon uyumsuzluğu / Demografi-operasyon riski / Eksik veri / Fotoğraf kalitesi) + güven yüzdesi rozeti + gerekçe; **"Uygunluk değerlendirmesi"** başlıklı `suitability_note` (whitespace-pre-wrap).
- `canGiveFeedback` (yalnız doktor görünümünde): altta "Bu değerlendirme:" + üç `Button variant="secondary"` (Doğru/Kısmen doğru/Yanlış) + opsiyonel not input + gönder; gönderilmişse mevcut geri bildirimi rozetle gösterir (yeniden gönderim yok — unique).
- [ ] tsc/build temiz; E2E hâlâ geçer (panel akışı bozmaz — AI satırı yoksa sessiz). Commit `feat: AI triyaj paneli + doktor geri bildirimi`.

## Task 6: Koordinatör doğruluk raporu (FR-55) + canlı uçtan uca doğrulama

**Files:** Modify `src/features/admin/DoctorAdmin.tsx` VEYA `AllRequests.tsx` üstüne küçük `Card` — karar: `AllRequests` sayfası üstünde `AiAccuracyCard` (Create `src/features/ai/AiAccuracyCard.tsx`): tenant `ai_feedback` dağılımı (Doğru/Kısmen/Yanlış sayıları + yüzde çubuğu).
- [ ] Canlı tur (controller): satışçı yeni talep (fotolu) → ai_evaluation oluşur → doktor panelde uyarı+uygunluk görür → doğru/yanlış işaretler → koordinatör dağılımı görür → **agent AI panelini GÖREMEZ** (DB-token 0 satır + UI). E2E + 78 test + build yeşil.
- [ ] Commit `feat: AI doğruluk raporu` + final review + merge.

## Self-Review Notları
- Spec §3.1 M2a (edge+model+uyarılar+disclaimer+FR-11+gösterim) → T1-T5. §3.1 M2b (feedback+bağlam öğrenme+rapor) → T1 (tablo), T3 (feedbackHints), T5 (feedback UI), T6 (rapor). ✅
- §2 sapma (satışçı görür, agent görmez) → T1 RLS + T5 RoleGate. §10.4 sınırlar → T2 system prompt + testleri. ✅
- Kullanıcı gereksinimi ("şu işlemler yapılabilir" yorumu) → OUTPUT_SCHEMA.suitability_note + T5 "Uygunluk değerlendirmesi" bölümü. ✅
```
