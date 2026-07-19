-- M3 review sertleştirmeleri: sweep RPC'si client'tan çağrılamaz; SLA ayarları
-- tutarlılık kısıtları; süpürücü hataları sessiz değil warning ile loglanır.

revoke execute on function run_sla_sweep() from public, anon, authenticated;

alter table tenant add constraint tenant_sla_hours_positive check (sla_hours > 0);
alter table tenant add constraint tenant_sla_reminder_valid
  check (sla_reminder_hours >= 0 and sla_reminder_hours <= sla_hours);

create or replace function run_sla_sweep()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_secret text;
  rec record;
begin
  insert into score_event (tenant_id, doctor_id, request_id, assignment_id, delta, reason)
  select r.tenant_id, a.doctor_id, a.request_id, a.id, -1, 'sla_breach'
  from assignment a
  join request r on r.id = a.request_id
  join tenant t on t.id = r.tenant_id
  where not exists (
    select 1 from response resp
    where resp.request_id = a.request_id and resp.doctor_id = a.doctor_id
  )
  and now() > a.assigned_at + make_interval(hours => t.sla_hours)
  on conflict (assignment_id) do nothing;

  select value into v_secret from app_secret where name = 'notify_webhook_secret';
  if v_secret is null then return; end if;

  for rec in
    select a.id
    from assignment a
    join request r on r.id = a.request_id
    join tenant t on t.id = r.tenant_id
    where a.reminder_sent_at is null
    and not exists (
      select 1 from response resp
      where resp.request_id = a.request_id and resp.doctor_id = a.doctor_id
    )
    and now() > a.assigned_at + make_interval(hours => t.sla_hours - t.sla_reminder_hours)
    and now() <= a.assigned_at + make_interval(hours => t.sla_hours)
    limit 50
  loop
    update assignment set reminder_sent_at = now() where id = rec.id;
    perform net.http_post(
      url := 'https://oxibdniwobetaksuxacs.supabase.co/functions/v1/notify-sla',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object('assignment_id', rec.id)
    );
  end loop;
exception when others then
  raise warning 'run_sla_sweep: %', sqlerrm; -- süpürücü hatası akış bozmaz ama izlenebilir
end;
$$;
