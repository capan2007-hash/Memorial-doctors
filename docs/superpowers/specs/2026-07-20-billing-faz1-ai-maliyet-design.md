# Billing Faz 1 — AI Maliyet Ölçüm Katmanı — Tasarım

**Tarih:** 2026-07-20 · **Durum:** Onaylandı · **Kapsam:** Her Anthropic çağrısının token kullanımını + USD maliyetini firma (tenant) ve servis bazında gerçek-zaman kaydetmek. Billing'in (Faz 2-4) ön koşulu; tek başına "gerçek AI maliyeti" görünürlüğü sağlar.

## Bağlam (denetim)
Bugün AI çağrıları (`ai-triage` = triage, `duplicate-vision` = vision) Anthropic'i çağırıyor ama **`response.usage` atılıyor; hiçbir token/maliyet kaydı yok.** Ücretlenen tek per-firma servis bu iki AI çağrısı (push $0, Supabase org-sabit). Model: `claude-opus-4-8` ($5/M girdi, $25/M çıktı).

## Üst planın kararları (SaaS reseller — Faz 2-4 için not)
Süper admin = platform-üstü (tüm firmalar). Fatura = AI + altyapı tahmini, USD, haftalık 2×. Ödeme başarısız → 3 gün grace → askı. Doktor silme = soft (pasifleştir+auth kapat). Altyapı tahsis tabanı = AI-çağrı payı. **Bu Faz yalnız ÖLÇÜM; UI/Stripe sonraki fazlar.**

## Veri Modeli (migration 0033)
```sql
-- Yapılandırılabilir model fiyatları (fiyat değişince güncellenir; billing bunu okur).
create table model_price (
  model text primary key,
  input_usd_per_mtok numeric not null,
  output_usd_per_mtok numeric not null,
  cache_write_multiplier numeric not null default 1.25,  -- Anthropic prompt-cache yazma
  cache_read_multiplier numeric not null default 0.10,   -- cache okuma
  updated_at timestamptz not null default now()
);
insert into model_price (model, input_usd_per_mtok, output_usd_per_mtok)
  values ('claude-opus-4-8', 5, 25);

-- Her AI çağrısının kullanım+maliyet defteri (gerçek-zaman, servis+firma bazlı).
create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  service text not null,                 -- 'triage' | 'vision'
  request_id uuid references request(id),
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_tenant_created_idx on ai_usage(tenant_id, created_at);
alter table ai_usage enable row level security;
-- Faz 1: yazma yalnız service-role (edge fn). Okuma: admin/koordinatör kendi firmasının
-- maliyetini görebilir (şeffaflık). Faz 2 süper admin cross-tenant'ı edge fn ile okur.
create policy ai_usage_own_read on ai_usage for select using (
  tenant_id = current_tenant_id() and current_role_name() in ('admin','coordinator')
);
alter table model_price enable row level security;  -- okuma herkese kapalı; edge fn service-role okur
```

## Maliyet formülü
Anthropic `response.usage` alanları: `input_tokens`, `output_tokens` (thinking dahil), `cache_creation_input_tokens`, `cache_read_input_tokens`.
```
inP = input_usd_per_mtok / 1e6 ; outP = output_usd_per_mtok / 1e6
cost_usd = input_tokens*inP + output_tokens*outP
         + cache_write_tokens*inP*cache_write_multiplier
         + cache_read_tokens*inP*cache_read_multiplier
```
Bu iki fonksiyon cache kullanmıyor (cache_* = 0 beklenir) ama alanlar yine de yakalanır (ileride caching eklenirse doğru).

## Edge fn enstrümantasyonu
`ai-triage/index.ts` ve `duplicate-vision/index.ts`: başarılı `messages.create` SONRASI, best-effort (asla çağrıyı bloklamaz):
1. `const u = response.usage`
2. `model_price` satırını service-role ile çek (yoksa atla).
3. Yukarıdaki formülle `cost_usd` hesapla.
4. `ai_usage` satırı ekle (service='triage'|'vision', request_id, tenant_id, tokenlar, cost). `.then(()=>{},()=>{})` ile hatayı yut.
- ai-triage: `ai_evaluation` upsert'ten SONRA ekle. duplicate-vision: `writeCheck` başarı yolunda ekle.

## Test
- Migration canlı doğrulama: tablolar + model_price satırı + RLS (get_advisors uyarı yok).
- Enstrümantasyon canlı: onamlı bir talep için ai-triage tetikle → `ai_usage`'da service='triage' satırı, input/output_tokens>0, cost_usd>0. duplicate-vision benzer (service='vision').
- Maliyet doğruluğu: elde hesapla (input*5/1e6 + output*25/1e6) ≈ cost_usd.
- RLS: aracı/sales `ai_usage` okuyamaz; admin/koordinatör kendi firmasını okur; başka tenant görmez.

## Kapsam Dışı (sonraki fazlar)
- Billing ekranı/UI (Faz 2). Altyapı tahsisi (Faz 3). Stripe/tahsilat/gating (Faz 4). super_admin rolü (Faz 2).

## İlgili Kod
- `supabase/functions/ai-triage/index.ts:155` (messages.create), `duplicate-vision/index.ts:88`. Model: `ai-triage/triage.ts:7`, `duplicate-vision/vision.ts:1`. Fiyatlar: claude-api skill model tablosu (Opus 4.8 $5/$25).
