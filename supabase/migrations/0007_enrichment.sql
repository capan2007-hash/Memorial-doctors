-- Enums
create type gender_type as enum ('female','male','other');
create type photo_kind as enum ('photo','xray');

-- request: demografi + tıbbi snapshot
alter table request add column age int;
alter table request add column weight_kg numeric;
alter table request add column height_cm int;
alter table request add column gender gender_type;
alter table request add column past_surgeries text not null default 'Yok';
alter table request add column known_conditions text not null default 'Yok';
alter table request add column medications text not null default 'Yok';

-- photo: tür (foto | röntgen)
alter table photo add column kind photo_kind not null default 'photo';

-- doctor_scope: çoklu yetkinlik (kategori/alt-kırılım)
create table doctor_scope (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  doctor_id uuid not null references doctor(id) on delete cascade,
  category_id uuid not null references category(id),
  subcategory_id uuid references subcategory(id),
  unique (doctor_id, category_id, subcategory_id)
);
create index on doctor_scope (doctor_id);
create index on doctor_scope (category_id, subcategory_id);

alter table doctor_scope enable row level security;
create policy scope_tenant_read on doctor_scope for select using (tenant_id = current_tenant_id());
create policy scope_admin_all on doctor_scope for all
  using (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'))
  with check (tenant_id = current_tenant_id());

-- Backfill: mevcut doktorların category/subcategory'sini scope'a taşı
insert into doctor_scope (tenant_id, doctor_id, category_id, subcategory_id)
select tenant_id, id, category_id, subcategory_id from doctor
on conflict do nothing;

-- Güvenlik: M1 trigger fonksiyonu RPC olarak çağrılamaz (yalnız trigger'dan çalışır)
revoke execute on function recompute_request_status() from public, anon, authenticated;
