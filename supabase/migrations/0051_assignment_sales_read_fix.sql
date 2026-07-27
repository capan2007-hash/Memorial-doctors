-- 0050 DÜZELTME: policy request'e bakıyordu, request'in kendi policy'si (req_doctor_read)
-- assignment'a baktığı için KARŞILIKLI ÖZYİNELEME oluştu (Postgres 42P17:
-- "infinite recursion detected in policy for relation assignment").
-- Çözüm: kontrolü SECURITY DEFINER fonksiyona taşı → fonksiyon RLS'i bypass eder, döngü kırılır.
drop policy if exists asg_sales_group_read on assignment;

create or replace function is_sales_group_request(p_request_id uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (
    select 1
    from request r
    join app_user u on u.id = r.created_by
    where r.id = p_request_id
      and r.tenant_id = current_tenant_id()
      and u.role in ('sales', 'agent')
  )
$$;

revoke execute on function is_sales_group_request(uuid) from public, anon;
grant execute on function is_sales_group_request(uuid) to authenticated;

create policy asg_sales_group_read on assignment for select using (
  tenant_id = current_tenant_id()
  and current_role_name() = 'sales'
  and is_sales_group_request(request_id)
);
