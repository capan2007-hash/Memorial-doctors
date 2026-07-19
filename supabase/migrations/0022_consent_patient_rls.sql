-- P1: KVKK onam kolonları + patient RLS daraltma (gizlilik O1).

alter table request add column consent_at timestamptz;
alter table request add column consent_channel text;
alter table request add column consented_by uuid references app_user(id);

alter table patient add column created_by uuid references app_user(id);

-- patient SELECT daraltma: eski "tenant'ta herkes okur" politikası kaldırılır.
-- Aracı/satışçı yalnız kendi oluşturduğu hastayı VEYA kendi talebine bağlı hastayı
-- görür (tüm hastaların telefon/e-postasını göremez). Doktor: atandığı taleplerin
-- hastaları. Koordinatör/admin: tüm tenant.
drop policy tenant_read_patient on patient;
create policy patient_read on patient for select using (
  tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator', 'admin')
    or created_by = auth.uid()
    or exists (select 1 from request r where r.patient_id = patient.id and r.created_by = auth.uid())
    or exists (
      select 1 from request r
      join assignment a on a.request_id = r.id
      where r.patient_id = patient.id and a.doctor_id = current_doctor_id()
    )
  )
);
