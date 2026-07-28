-- Hastane tanımı + koordinatör/admin'in doktor kimliğini (ad/unvan/branş/hastane)
-- güncelleyebilmesi.
--
-- SORUN: Doktorun ADI app_user.full_name'de tutuluyor ama app_user üzerinde YALNIZ
-- SELECT policy'si var (tenant_read_appuser) — UPDATE policy'si yok. Bu yüzden
-- koordinatör/süper admin arayüzden doktor adını değiştiremiyordu.
--
-- ÇÖZÜM: app_user'a genel UPDATE policy'si AÇMIYORUZ (rol/tenant değiştirme gibi
-- yetki yükseltme yollarını açar). Bunun yerine dar kapsamlı SECURITY DEFINER RPC:
-- yalnız DOKTOR rolündeki kullanıcının full_name'i + doctor satırının kimlik
-- alanları, yalnız çağıranın kendi tenant'ı içinde güncellenir.

-- 1) Hastane tablosu (tenant kapsamlı).
create table if not exists hospital (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table hospital enable row level security;

-- Okuma: tenant içindeki herkes (doktor kartında hastane adı görünür).
drop policy if exists tenant_read_hospital on hospital;
create policy tenant_read_hospital on hospital
  for select using (tenant_id = current_tenant_id());

-- Yazma: yalnız koordinatör/admin/süper admin.
drop policy if exists hospital_admin_all on hospital;
create policy hospital_admin_all on hospital
  for all using (
    tenant_id = current_tenant_id()
    and current_role_name() in ('coordinator', 'admin', 'super_admin')
  ) with check (
    tenant_id = current_tenant_id()
    and current_role_name() in ('coordinator', 'admin', 'super_admin')
  );

-- 2) Doktor → hastane bağı. Hastane silinirse doktor kaydı kalır (set null).
alter table doctor add column if not exists hospital_id uuid references hospital(id) on delete set null;
create index if not exists doctor_hospital_idx on doctor (hospital_id);

-- 3) Memorial hastane listesi (mevcut tenant'lara). Ad bazlı unique → tekrar çalıştırılabilir.
insert into hospital (tenant_id, name, sort_order)
select t.id, h.name, h.ord
from tenant t
cross join (values
  ('Bahçelievler Hastanesi', 1),
  ('Şişli Hastanesi', 2),
  ('Göztepe Hastanesi', 3),
  ('Ankara Hastanesi', 4),
  ('Ataşehir Hastanesi', 5),
  ('Antalya Hastanesi', 6),
  ('Kayseri Hastanesi', 7),
  ('Bodrum Hastanesi', 8)
) as h(name, ord)
on conflict (tenant_id, name) do nothing;

-- 4) Koordinatör/admin: doktor kimlik alanlarını güncelle.
-- Ad app_user.full_name'de, diğerleri doctor tablosunda; ikisi tek işlemde yazılır.
-- p_full_name null/boş gelirse ad DEĞİŞTİRİLMEZ (yanlışlıkla adı silmeyi önler).
create or replace function admin_update_doctor_identity(
  p_doctor_id uuid,
  p_full_name text,
  p_title text,
  p_specialty text,
  p_hospital_id uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid;
  v_app_user uuid;
begin
  if current_role_name() not in ('coordinator', 'admin', 'super_admin') then
    raise exception 'forbidden';
  end if;

  -- Doktor çağıranın tenant'ında olmalı (çapraz-tenant yazmayı kapatır).
  select tenant_id, app_user_id into v_tenant, v_app_user
  from doctor where id = p_doctor_id;
  if v_tenant is null then raise exception 'doctor not found'; end if;
  if v_tenant <> current_tenant_id() then raise exception 'forbidden'; end if;

  -- Hastane verildiyse aynı tenant'a ait olmalı.
  if p_hospital_id is not null then
    if not exists (select 1 from hospital where id = p_hospital_id and tenant_id = v_tenant) then
      raise exception 'hospital not in tenant';
    end if;
  end if;

  update doctor set
    title = p_title,
    specialty = p_specialty,
    hospital_id = p_hospital_id
  where id = p_doctor_id;

  -- Ad: YALNIZ doctor rolündeki bağlı kullanıcının full_name'i güncellenir.
  -- role/tenant/email/is_active bu RPC ile ASLA değişmez.
  if v_app_user is not null and coalesce(btrim(p_full_name), '') <> '' then
    update app_user
    set full_name = btrim(p_full_name)
    where id = v_app_user and tenant_id = v_tenant and role = 'doctor';
  end if;

  insert into audit_log (tenant_id, actor_id, action, entity, after)
  values (v_tenant, auth.uid(), 'doctor_identity_update', 'doctor',
          jsonb_build_object('doctor_id', p_doctor_id, 'hospital_id', p_hospital_id));
end;
$$;

revoke execute on function admin_update_doctor_identity(uuid, text, text, text, uuid) from public, anon;
grant execute on function admin_update_doctor_identity(uuid, text, text, text, uuid) to authenticated;
