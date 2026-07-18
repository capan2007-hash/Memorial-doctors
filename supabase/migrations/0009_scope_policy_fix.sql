-- Final review (Important): doctor_scope scope_admin_all WITH CHECK'inde rol
-- predikatı eksikti; INSERT'te yalnız WITH CHECK uygulandığı için aynı-tenant
-- herhangi bir authenticated kullanıcı (agent/sales/doctor) doğrudan doctor_scope
-- satırı ekleyip atama yönlendirmesini etkileyebiliyordu. Rol predikatını ekliyoruz.
drop policy scope_admin_all on doctor_scope;
create policy scope_admin_all on doctor_scope for all
  using (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'))
  with check (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'));
