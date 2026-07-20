-- Billing Faz 1: AI kullanım+maliyet defteri (gerçek-zaman, servis+firma bazlı).
create table model_price (
  model text primary key,
  input_usd_per_mtok numeric not null,
  output_usd_per_mtok numeric not null,
  cache_write_multiplier numeric not null default 1.25,
  cache_read_multiplier numeric not null default 0.10,
  updated_at timestamptz not null default now()
);
insert into model_price (model, input_usd_per_mtok, output_usd_per_mtok)
  values ('claude-opus-4-8', 5, 25);
alter table model_price enable row level security;
-- Okuma client'a kapalı (edge fn service-role okur); yazma service-role.

create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  service text not null,
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
create policy ai_usage_own_read on ai_usage for select using (
  tenant_id = current_tenant_id() and current_role_name() in ('admin','coordinator')
);
