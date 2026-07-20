-- Yeni talebi yönlendir: hastanın AÇIK başka talebi telefon/isimle eşleşiyorsa
-- pending+parent yap (atama YOK); yoksa assign_request_doctors çalıştır.
create or replace function route_new_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_req record;
  v_np text;
  v_nm text;
  v_parent uuid;
  v_assigned int;
begin
  select r.*, p.first_name as p_first, p.last_name as p_last, p.phone as p_phone
    into v_req
  from request r join patient p on p.id = r.patient_id
  where r.id = p_request_id and r.tenant_id = current_tenant_id();
  if v_req.id is null then raise exception 'talep bulunamadı'; end if;
  if not (v_req.created_by = auth.uid() or current_role_name() in ('coordinator','admin')) then
    raise exception 'yetki yok';
  end if;

  v_np := normalize_phone(v_req.p_phone);
  v_nm := trim(coalesce(v_req.p_first,'') || ' ' || coalesce(v_req.p_last,''));

  -- Aday: aynı tenant, FARKLI talep, AÇIK (status<>'closed'), confirmed olmayan,
  -- telefon (>=7 hane eşit) VEYA isim benzerliği>0.3. En son açık = ana talep.
  select r2.id into v_parent
  from request r2 join patient p2 on p2.id = r2.patient_id
  where r2.tenant_id = v_req.tenant_id
    and r2.id <> v_req.id
    and r2.status <> 'closed'
    and r2.dup_state <> 'confirmed'
    and (
      (length(v_np) >= 7 and normalize_phone(p2.phone) = v_np)
      or (v_nm <> '' and similarity(p2.first_name || ' ' || p2.last_name, v_nm) > 0.3)
    )
  order by r2.created_at desc
  limit 1;

  if v_parent is not null then
    update request set dup_state = 'pending', duplicate_of_request_id = v_parent
    where id = v_req.id;
    insert into audit_log (tenant_id, actor_id, action, entity, after)
    values (v_req.tenant_id, auth.uid(), 'request_dup_pending', 'request',
            jsonb_build_object('request_id', v_req.id, 'parent', v_parent));
    return jsonb_build_object('routed','coordinator','parentId', v_parent);
  end if;

  v_assigned := assign_request_doctors(v_req.id);
  return jsonb_build_object('routed','doctors','assignedCount', v_assigned);
end;
$$;
revoke execute on function route_new_request(uuid) from public, anon;
grant execute on function route_new_request(uuid) to authenticated;
