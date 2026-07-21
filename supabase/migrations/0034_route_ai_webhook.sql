-- AI tetiklemesini sunucuya taşı: route_new_request yönlendirmeyi belirledikten
-- SONRA pg_net ile ilgili AI edge fn'ini çağırır (onam varsa). Böylece AI, istemci
-- fire-and-forget invoke'una (tarayıcı navigasyonu iptal edebiliyordu) bağımlı olmaz.
-- Kimlik: notify-assignment ile aynı x-webhook-secret (app_secret).
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
  v_secret text;
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

  -- AI tetiklemesi için webhook secret'ı (onam varsa kullanılır).
  select value into v_secret from app_secret where name = 'notify_webhook_secret';

  if v_parent is not null then
    update request set dup_state = 'pending', duplicate_of_request_id = v_parent
    where id = v_req.id;
    insert into audit_log (tenant_id, actor_id, action, entity, after)
    values (v_req.tenant_id, auth.uid(), 'request_dup_pending', 'request',
            jsonb_build_object('request_id', v_req.id, 'parent', v_parent));
    -- Mükerrer-şüphesi + onam → görsel karşılaştırma (sunucudan).
    if v_req.consent_at is not null and v_secret is not null then
      begin
        perform net.http_post(
          url := 'https://oxibdniwobetaksuxacs.supabase.co/functions/v1/duplicate-vision',
          headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',v_secret),
          body := jsonb_build_object('requestId', v_req.id),
          timeout_milliseconds := 55000
        );
      exception when others then null; end;
    end if;
    return jsonb_build_object('routed','coordinator','parentId', v_parent);
  end if;

  v_assigned := assign_request_doctors(v_req.id);
  -- Doktorlara gitti + onam → AI ön-triyaj (sunucudan).
  if v_req.consent_at is not null and v_secret is not null then
    begin
      perform net.http_post(
        url := 'https://oxibdniwobetaksuxacs.supabase.co/functions/v1/ai-triage',
        headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',v_secret),
        body := jsonb_build_object('requestId', v_req.id)
      );
    exception when others then null; end;
  end if;
  return jsonb_build_object('routed','doctors','assignedCount', v_assigned);
end;
$$;
revoke execute on function route_new_request(uuid) from public, anon;
grant execute on function route_new_request(uuid) to authenticated;
