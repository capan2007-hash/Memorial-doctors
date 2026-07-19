-- P1-2 (Fable raporu): satışçı/aracı kendi talebini HER statüde silebiliyordu;
-- cascade tedavi planlarını + AI kayıtlarını + fotoğrafları da götürür (kanıt imhası).
-- Çözüm: creator FOR ALL politikasını select/insert/update'e böl — DELETE kalkar.
-- Koordinatör/admin (req_admin_all FOR ALL) silmeye devam eder.

drop policy req_creator_rw on request;

create policy req_creator_read on request for select
  using (tenant_id = current_tenant_id() and created_by = auth.uid()
    and current_role_name() in ('agent', 'sales'));

create policy req_creator_insert on request for insert
  with check (tenant_id = current_tenant_id() and created_by = auth.uid()
    and current_role_name() in ('agent', 'sales'));

create policy req_creator_update on request for update
  using (tenant_id = current_tenant_id() and created_by = auth.uid()
    and current_role_name() in ('agent', 'sales'))
  with check (tenant_id = current_tenant_id() and created_by = auth.uid());
