-- Satışçı self-servis mükerrer kontrolü: sales rolü, satış-grubunun (oluşturucusu
-- sales VEYA agent olan) girdiği TÜM taleplerin talep/hasta/foto bilgisini okuyabilir.
-- Böylece satışçı, akış + arama ekranından biriken kayıtları tarayıp mükerreri
-- sistem dışında kendisi kontrol edebilir.
--
-- ADDITIVE: mevcut politikalar KORUNUR (req_creator_read=own, photo_read=own-active,
-- patient_read=own). Yeni SELECT politikaları OR ile birleşir. AGENT rolü DEĞİŞMEZ
-- (yalnız kendi taleplerini görür). response zaten sales'e açık (resp_sales_admin_read)
-- → yalnız request/patient/photo genişletilir. Arşiv fotoğrafı sales'e KAPALI (layer='active').

create policy req_sales_group_read on request for select using (
  tenant_id = current_tenant_id()
  and current_role_name() = 'sales'
  and exists (
    select 1 from app_user u
    where u.id = request.created_by
      and u.tenant_id = request.tenant_id
      and u.role in ('sales', 'agent')
  )
);

create policy patient_sales_group_read on patient for select using (
  tenant_id = current_tenant_id()
  and current_role_name() = 'sales'
  and exists (
    select 1 from request r
    join app_user u on u.id = r.created_by
    where r.patient_id = patient.id
      and r.tenant_id = patient.tenant_id
      and u.role in ('sales', 'agent')
  )
);

create policy photo_sales_group_read on photo for select using (
  tenant_id = current_tenant_id()
  and current_role_name() = 'sales'
  and layer = 'active'
  and exists (
    select 1 from request r
    join app_user u on u.id = r.created_by
    where r.id = photo.request_id
      and r.tenant_id = photo.tenant_id
      and u.role in ('sales', 'agent')
  )
);
