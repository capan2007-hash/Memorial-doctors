-- Doktor yetkinliklerini (doctor_scope) atomik güncelle: tek transaction'da
-- delete + insert. Client'ta delete-sonra-insert yarım kalırsa yetkinlikler
-- sessizce silinebiliyordu (Task 7 review — Important). RPC bunu tek işlemde yapar
-- ve çağıranın o tenant'ta coordinator/admin olduğunu doğrular.
create or replace function set_doctor_scopes(p_doctor_id uuid, p_scopes jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from doctor where id = p_doctor_id;
  if v_tenant is null then raise exception 'doctor not found'; end if;
  if current_tenant_id() is distinct from v_tenant
     or current_role_name() not in ('coordinator','admin') then
    raise exception 'forbidden';
  end if;

  delete from doctor_scope where doctor_id = p_doctor_id;
  insert into doctor_scope (tenant_id, doctor_id, category_id, subcategory_id)
  select v_tenant, p_doctor_id,
         (e->>'categoryId')::uuid,
         nullif(e->>'subcategoryId','')::uuid
  from jsonb_array_elements(coalesce(p_scopes, '[]'::jsonb)) e;
end $$;

revoke execute on function set_doctor_scopes(uuid, jsonb) from public, anon;
grant execute on function set_doctor_scopes(uuid, jsonb) to authenticated;
