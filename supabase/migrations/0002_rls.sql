-- Helper: aktif kullanıcının tenant'ı
create or replace function current_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from app_user where id = auth.uid()
$$;

create or replace function current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from app_user where id = auth.uid()
$$;

-- Aktif kullanıcının doctor id'si (doktor rolü için)
create or replace function current_doctor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from doctor where app_user_id = auth.uid()
$$;

alter table tenant enable row level security;
alter table app_user enable row level security;
alter table category enable row level security;
alter table subcategory enable row level security;
alter table operation_type enable row level security;
alter table doctor enable row level security;
alter table patient enable row level security;
alter table request enable row level security;
alter table photo enable row level security;
alter table assignment enable row level security;
alter table response enable row level security;
alter table audit_log enable row level security;

-- Tenant içi genel okuma (katalog + kendi tenant satırları)
create policy tenant_read_category on category for select using (tenant_id = current_tenant_id());
create policy tenant_read_subcategory on subcategory for select
  using (category_id in (select id from category where tenant_id = current_tenant_id()));
create policy tenant_read_operation on operation_type for select
  using (category_id in (select id from category where tenant_id = current_tenant_id()));
create policy tenant_read_doctor on doctor for select using (tenant_id = current_tenant_id());
create policy tenant_read_appuser on app_user for select using (tenant_id = current_tenant_id());
create policy tenant_read_patient on patient for select using (tenant_id = current_tenant_id());

-- coordinator/admin doktor yönetimi (ekle/güncelle)
create policy doctor_admin_all on doctor for all
  using (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'))
  with check (tenant_id = current_tenant_id());

-- request
create policy req_admin_all on request for all
  using (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'))
  with check (tenant_id = current_tenant_id());
-- satışçı/aracı: kendi oluşturduğu talepler
create policy req_creator_rw on request for all
  using (tenant_id = current_tenant_id() and created_by = auth.uid() and current_role_name() in ('agent','sales'))
  with check (tenant_id = current_tenant_id() and created_by = auth.uid());
-- doktor: yalnız kendisine atanan talepleri görür
create policy req_doctor_read on request for select
  using (tenant_id = current_tenant_id()
    and id in (select request_id from assignment where doctor_id = current_doctor_id()));

-- patient: agent/sales insert + tenant okuma; admin all
create policy patient_write on patient for insert
  with check (tenant_id = current_tenant_id() and current_role_name() in ('agent','sales','coordinator','admin'));
create policy patient_admin_all on patient for all
  using (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'))
  with check (tenant_id = current_tenant_id());

-- photo: talebi görebilen görebilir; agent kendi talebininkini yükler
create policy photo_read on photo for select
  using (tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator','admin')
    or request_id in (select id from request where created_by = auth.uid())
    or request_id in (select request_id from assignment where doctor_id = current_doctor_id())
  ));
create policy photo_write on photo for insert
  with check (tenant_id = current_tenant_id()
    and request_id in (select id from request where created_by = auth.uid()));

-- assignment: doktor kendi satırını görür/günceller (seen_at); admin all
create policy asg_doctor_rw on assignment for all
  using (tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator','admin') or doctor_id = current_doctor_id()))
  with check (tenant_id = current_tenant_id());

-- response: KRİTİK izin sınırı (FR-21)
--  - doctor: yalnız kendi response'unu yazar/görür
--  - sales/coordinator/admin: tenant içindeki tüm response'ları görür (planları sunar)
--  - agent: response'a HİÇ erişemez (politika yok => görünmez)
create policy resp_doctor_write on response for insert
  with check (tenant_id = current_tenant_id() and doctor_id = current_doctor_id());
create policy resp_doctor_read on response for select
  using (tenant_id = current_tenant_id() and doctor_id = current_doctor_id());
create policy resp_sales_admin_read on response for select
  using (tenant_id = current_tenant_id() and current_role_name() in ('sales','coordinator','admin'));

-- audit_log: admin okur; herkes kendi aksiyonunu yazar
create policy audit_write on audit_log for insert with check (tenant_id = current_tenant_id());
create policy audit_admin_read on audit_log for select
  using (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'));
