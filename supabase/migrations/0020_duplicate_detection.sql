-- M5: mükerrer kayıt tespiti (BRD §7.9, FR-40..FR-45).
-- Kalıcı Hasta ≠ geçici Talep. Telefon (birincil anahtar) + isim fuzzy eşleşmesi.

alter table request add column photos_required boolean not null default false;

create extension if not exists pg_trgm;

-- Telefonu normalize et: yalnız rakamlar, +90/0 önekleri soyulup son 10 hane.
create or replace function normalize_phone(raw text)
returns text
language sql immutable
as $$
  select right(regexp_replace(coalesce(raw, ''), '\D', '', 'g'), 10)
$$;

create index if not exists patient_phone_norm_idx on patient (normalize_phone(phone));
create index if not exists patient_name_trgm_idx on patient using gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- Gerçek zamanlı aday eşleşmeleri (tenant-scoped; definer RLS'i baypas eder, içeride filtre).
create or replace function find_patient_matches(p_phone text, p_first text, p_last text)
returns table (
  patient_id uuid,
  first_name text,
  last_name text,
  phone text,
  request_count bigint,
  last_request_at timestamptz,
  last_status text,
  has_open_request boolean,
  has_available_photos boolean,
  had_deleted_photos boolean,
  match_reason text
)
language sql
security definer set search_path = public
as $$
  with norm as (select normalize_phone(p_phone) as np, trim(coalesce(p_first,'') || ' ' || coalesce(p_last,'')) as nm),
  cands as (
    select p.id, p.first_name, p.last_name, p.phone,
      case when normalize_phone(p.phone) = (select np from norm) and length((select np from norm)) >= 7 then 'phone'
           else 'name' end as match_reason,
      case when normalize_phone(p.phone) = (select np from norm) and length((select np from norm)) >= 7 then 1 else 0 end as phone_hit,
      similarity(p.first_name || ' ' || p.last_name, (select nm from norm)) as sim
    from patient p
    where p.tenant_id = current_tenant_id()
      and (
        (length((select np from norm)) >= 7 and normalize_phone(p.phone) = (select np from norm))
        or ((select nm from norm) <> '' and similarity(p.first_name || ' ' || p.last_name, (select nm from norm)) > 0.3)
      )
  )
  select c.id, c.first_name, c.last_name, c.phone,
    (select count(*) from request r where r.patient_id = c.id),
    (select max(r.created_at) from request r where r.patient_id = c.id),
    (select r.status::text from request r where r.patient_id = c.id order by r.created_at desc limit 1),
    exists (select 1 from request r where r.patient_id = c.id and r.status <> 'closed'),
    exists (select 1 from photo ph join request r on r.id = ph.request_id where r.patient_id = c.id and ph.deleted_at is null),
    exists (select 1 from photo ph join request r on r.id = ph.request_id where r.patient_id = c.id and ph.deleted_at is not null),
    c.match_reason
  from cands c
  order by c.phone_hit desc, c.sim desc
  limit 5
$$;
revoke execute on function find_patient_matches(text, text, text) from public, anon;
grant execute on function find_patient_matches(text, text, text) to authenticated;
