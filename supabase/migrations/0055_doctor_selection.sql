-- Doktor seçimi: satışçı talebi TÜM uygun doktorlara ya da SEÇTİĞİ doktorlara yönlendirebilir.
-- null = tüm uygun doktorlar (mevcut davranış, geriye uyumlu). Dolu dizi = yalnız o doktorlar.
alter table request add column if not exists selected_doctor_ids uuid[];

-- assign_request_doctors: yeni p_doctor_ids parametresi.
-- GÜVENLİK: seçim istemciden gelir ama scope + is_active + tenant filtresi KORUNUR —
-- yani seçim yalnızca DARALTIR, asla yetkisiz doktora atama yapamaz (kesişim mantığı).
-- Not: eski 2 parametreli imza düşürülür (aksi halde overload belirsizliği oluşur).
drop function if exists assign_request_doctors(uuid, assignment_type);

create function assign_request_doctors(
  p_request_id uuid,
  p_type assignment_type default 'simultaneous'::assignment_type,
  p_doctor_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_req record;
  v_count int;
begin
  select r.* into v_req from request r
  where r.id = p_request_id and r.tenant_id = current_tenant_id();
  if v_req.id is null then
    raise exception 'talep bulunamadı';
  end if;
  if not (v_req.created_by = auth.uid() or current_role_name() in ('coordinator', 'admin')) then
    raise exception 'atama yetkisi yok';
  end if;
  if v_req.status = 'closed' then
    raise exception 'kapanmış talep yeniden atanamaz';
  end if;

  insert into assignment (tenant_id, request_id, doctor_id, type)
  select v_req.tenant_id, v_req.id, d.id, p_type
  from doctor d
  where d.tenant_id = v_req.tenant_id and d.is_active
    and exists (
      select 1 from doctor_scope s
      where s.doctor_id = d.id
        and s.category_id = v_req.category_id
        and (
          (v_req.subcategory_id is null and s.subcategory_id is null)
          or s.subcategory_id = v_req.subcategory_id
        )
    )
    and (p_doctor_ids is null or d.id = any(p_doctor_ids))
  on conflict (request_id, doctor_id) do nothing;

  select count(*) into v_count from assignment a
  join doctor d on d.id = a.doctor_id
  where a.request_id = v_req.id and d.is_active;

  if v_count > 0 then
    update request set status = 'assigned', assigned_at = coalesce(assigned_at, now())
    where id = v_req.id and status <> 'closed';
  end if;

  insert into audit_log (tenant_id, actor_id, action, entity, after)
  values (v_req.tenant_id, auth.uid(),
          case when p_type = 'manual' then 'reassign' else 'assign' end,
          'request', jsonb_build_object(
            'request_id', v_req.id,
            'assigned', v_count,
            'selected', p_doctor_ids is not null
          ));

  return v_count;
end;
$function$;

revoke execute on function assign_request_doctors(uuid, assignment_type, uuid[]) from public, anon;
grant execute on function assign_request_doctors(uuid, assignment_type, uuid[]) to authenticated;
