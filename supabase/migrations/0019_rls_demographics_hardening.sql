-- Sertleştirme: M1'den miras admin RLS WITH CHECK'lerine rol predikatı ekle.
-- Eski hâlde WITH CHECK yalnız tenant kontrol ediyordu → aynı tenant'taki agent/sales
-- doctor/request/patient satırını doğrudan INSERT/UPDATE edebiliyordu. Meşru yollar
-- (req_creator_rw, patient_write) ayrı politikalar olarak korunur.

alter policy doctor_admin_all on doctor
  with check (tenant_id = current_tenant_id() and current_role_name() in ('coordinator', 'admin'));
alter policy req_admin_all on request
  with check (tenant_id = current_tenant_id() and current_role_name() in ('coordinator', 'admin'));
alter policy patient_admin_all on patient
  with check (tenant_id = current_tenant_id() and current_role_name() in ('coordinator', 'admin'));

-- Demografi aralık kısıtları (client health.ts ile uyumlu): doğrudan API insert'i
-- wizard doğrulamasını atlayamasın. NULL serbest (ileride NOT NULL ayrı iş).
alter table request add constraint request_age_range check (age is null or (age between 1 and 120));
alter table request add constraint request_height_range check (height_cm is null or (height_cm between 50 and 250));
alter table request add constraint request_weight_range check (weight_kg is null or (weight_kg between 1 and 500));
