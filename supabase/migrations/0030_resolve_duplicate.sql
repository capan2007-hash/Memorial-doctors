-- Koordinatör mükerrer kararı: confirmed->pasif(closed), dismissed->doktorlara.
-- Karar duplicate_feedback'e ground-truth olarak yazılır (ok/not_ok).
create or replace function resolve_duplicate(p_request_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_req record;
  v_check uuid;
  v_label dup_fb_label;
  v_assigned int;
begin
  if current_role_name() not in ('coordinator','admin') then raise exception 'yetki yok'; end if;
  select * into v_req from request where id = p_request_id and tenant_id = current_tenant_id();
  if v_req.id is null then raise exception 'talep bulunamadı'; end if;
  if v_req.dup_state <> 'pending' then raise exception 'talep incelemede değil'; end if;
  if p_decision not in ('confirmed','dismissed') then raise exception 'geçersiz karar'; end if;

  select id into v_check from duplicate_check where request_id = v_req.id;

  if p_decision = 'confirmed' then
    update request set dup_state = 'confirmed', status = 'closed' where id = v_req.id;
    v_label := 'ok';
    insert into audit_log (tenant_id, actor_id, action, entity, after)
    values (v_req.tenant_id, auth.uid(), 'request_dup_confirmed', 'request',
            jsonb_build_object('request_id', v_req.id, 'parent', v_req.duplicate_of_request_id));
  else
    update request set dup_state = 'dismissed' where id = v_req.id;
    v_assigned := assign_request_doctors(v_req.id);
    v_label := 'not_ok';
    insert into audit_log (tenant_id, actor_id, action, entity, after)
    values (v_req.tenant_id, auth.uid(), 'request_dup_dismissed', 'request',
            jsonb_build_object('request_id', v_req.id, 'assigned', v_assigned));
  end if;

  insert into duplicate_feedback (tenant_id, request_id, duplicate_check_id, coordinator_label, note, decided_by)
  values (v_req.tenant_id, v_req.id, v_check, v_label, p_note, auth.uid())
  on conflict (request_id) do update set
    coordinator_label = excluded.coordinator_label, note = excluded.note,
    decided_by = excluded.decided_by, decided_at = now();

  return jsonb_build_object('decision', p_decision, 'label', v_label::text,
                            'assignedCount', coalesce(v_assigned, 0));
end;
$$;
revoke execute on function resolve_duplicate(uuid, text, text) from public, anon;
grant execute on function resolve_duplicate(uuid, text, text) to authenticated;
