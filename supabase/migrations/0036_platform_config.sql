-- Billing Faz 3: platform altyapı maliyeti (aylık, super_admin girer). Billing bunu
-- firmalara AI-çağrı payına göre dağıtır ("Altyapı (tahmini)" satırı).
create table platform_config (
  id int primary key default 1,
  infra_monthly_usd numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint platform_config_singleton check (id = 1)
);
insert into platform_config (id, infra_monthly_usd) values (1, 0) on conflict do nothing;
alter table platform_config enable row level security;
-- Yalnız service-role (billing-admin edge fn) okur/yazar; client politikası yok.
