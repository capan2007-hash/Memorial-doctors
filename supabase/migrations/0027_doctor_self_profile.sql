-- Doktor öz-profili: doktor kendi profil alanlarını + yetkinliklerini yönetir.
-- Doğrudan doctor UPDATE RLS'i verilmez (skor trigger'ıyla çakışır + skor/aktiflik
-- korunmalı); whitelist'li SECURITY DEFINER RPC'ler kullanılır.

-- Doktor kendi yetkinliklerini okuyabilsin (şu an yalnız koordinatör/admin okuyor).
create policy scope_self_read on doctor_scope for select
  using (tenant_id = current_tenant_id() and doctor_id = current_doctor_id());

-- Profil alanları güncelleme (yalnız izinli kolonlar; skor/is_active vb. dokunulmaz).
create or replace function update_own_doctor_profile(
  p_title text, p_specialty text, p_bio text, p_weighted_work jsonb, p_photo_url text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_doctor uuid;
  v_tenant uuid;
begin
  if current_role_name() <> 'doctor' then raise exception 'forbidden'; end if;
  v_doctor := current_doctor_id();
  if v_doctor is null then raise exception 'doctor not found'; end if;
  select tenant_id into v_tenant from doctor where id = v_doctor;

  update doctor set
    title = p_title,
    specialty = p_specialty,
    bio = p_bio,
    weighted_work = coalesce(p_weighted_work, weighted_work),
    photo_url = p_photo_url
  where id = v_doctor;

  insert into audit_log (tenant_id, actor_id, action, entity, after)
  values (v_tenant, auth.uid(), 'doctor_self_update', 'doctor',
          jsonb_build_object('doctor_id', v_doctor));
end $$;
revoke execute on function update_own_doctor_profile(text, text, text, jsonb, text) from public, anon;
grant execute on function update_own_doctor_profile(text, text, text, jsonb, text) to authenticated;

-- Kendi yetkinliklerini (doctor_scope) yeniden yaz.
create or replace function set_own_doctor_scopes(p_scopes jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_doctor uuid;
  v_tenant uuid;
begin
  if current_role_name() <> 'doctor' then raise exception 'forbidden'; end if;
  v_doctor := current_doctor_id();
  if v_doctor is null then raise exception 'doctor not found'; end if;
  if jsonb_array_length(coalesce(p_scopes, '[]'::jsonb)) = 0 then
    raise exception 'en az bir yetkinlik gerekli';
  end if;
  select tenant_id into v_tenant from doctor where id = v_doctor;

  delete from doctor_scope where doctor_id = v_doctor;
  insert into doctor_scope (tenant_id, doctor_id, category_id, subcategory_id)
  select v_tenant, v_doctor,
         (e->>'categoryId')::uuid,
         nullif(e->>'subcategoryId', '')::uuid
  from jsonb_array_elements(p_scopes) e;

  insert into audit_log (tenant_id, actor_id, action, entity, after)
  values (v_tenant, auth.uid(), 'doctor_self_scopes', 'doctor',
          jsonb_build_object('doctor_id', v_doctor));
end $$;
revoke execute on function set_own_doctor_scopes(jsonb) from public, anon;
grant execute on function set_own_doctor_scopes(jsonb) to authenticated;

-- Kendi performans özeti (doctor_performance_summary'nin öz-versiyonu).
create or replace function own_doctor_performance()
returns table (
  doctor_id uuid, score int,
  accept_count bigint, reject_count bigint, avg_response_mins numeric,
  timely_count bigint, breach_count bigint, pending_count bigint
)
language sql security definer set search_path = public
as $$
  select
    d.id, d.score,
    coalesce((select count(*) from response r where r.doctor_id = d.id and r.decision = 'accept'), 0),
    coalesce((select count(*) from response r where r.doctor_id = d.id and r.decision = 'reject'), 0),
    (select round(avg(extract(epoch from (r.responded_at - a.assigned_at)) / 60.0)::numeric, 1)
      from response r
      join assignment a on a.request_id = r.request_id and a.doctor_id = r.doctor_id
      where r.doctor_id = d.id and r.responded_at >= a.assigned_at),
    coalesce((select count(*) from score_event se where se.doctor_id = d.id and se.reason = 'timely_response'), 0),
    coalesce((select count(*) from score_event se where se.doctor_id = d.id and se.reason = 'sla_breach'), 0),
    coalesce((select count(*) from assignment a
      join request req on req.id = a.request_id
      where a.doctor_id = d.id and req.status <> 'closed'
        and not exists (select 1 from response r2 where r2.request_id = a.request_id and r2.doctor_id = d.id)), 0)
  from doctor d
  where d.id = current_doctor_id() and current_role_name() = 'doctor'
$$;
revoke execute on function own_doctor_performance() from public, anon;
grant execute on function own_doctor_performance() to authenticated;
