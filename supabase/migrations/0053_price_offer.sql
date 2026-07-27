-- Fiyat teklifi + ameliyat tarihi (satış akışı geliştirmesi).
-- Teklif GEÇMİŞİ tutulur (indirim/revizyon izlenebilsin); en yenisi geçerli sayılır.

create table if not exists price_offer (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency in ('EUR', 'USD')),
  created_by uuid not null references app_user(id),
  created_at timestamptz not null default now()
);

create index if not exists price_offer_request_idx on price_offer (request_id, created_at desc);

-- Teklifin verildiği doktor(lar) — bir teklif birden çok doktor için iletilebilir.
create table if not exists price_offer_doctor (
  offer_id uuid not null references price_offer(id) on delete cascade,
  doctor_id uuid not null references doctor(id),
  primary key (offer_id, doctor_id)
);

-- Ameliyat tarihi: satış tamamlanırken girilir.
alter table request add column if not exists surgery_date date;

-- RLS: fiyat TİCARİ bilgidir → yalnız satış/koordinasyon tarafı görür.
-- DOKTOR ve ARACI (agent) GÖRMEZ (politika listesinde yoklar).
alter table price_offer enable row level security;
alter table price_offer_doctor enable row level security;

create policy offer_read on price_offer for select using (
  tenant_id = current_tenant_id()
  and current_role_name() in ('sales', 'coordinator', 'admin', 'super_admin')
);

create policy offer_write on price_offer for insert with check (
  tenant_id = current_tenant_id()
  and current_role_name() in ('sales', 'coordinator', 'admin', 'super_admin')
  and created_by = auth.uid()
);

-- Bağlantı tablosu yetkiyi teklif üzerinden devralır (price_offer politikası
-- bu tabloya BAKMAZ → özyineleme yok).
create policy offer_doctor_read on price_offer_doctor for select using (
  exists (
    select 1 from price_offer o
    where o.id = price_offer_doctor.offer_id
      and o.tenant_id = current_tenant_id()
      and current_role_name() in ('sales', 'coordinator', 'admin', 'super_admin')
  )
);

create policy offer_doctor_write on price_offer_doctor for insert with check (
  exists (
    select 1 from price_offer o
    where o.id = price_offer_doctor.offer_id
      and o.tenant_id = current_tenant_id()
      and current_role_name() in ('sales', 'coordinator', 'admin', 'super_admin')
  )
);
