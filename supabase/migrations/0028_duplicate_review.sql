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
