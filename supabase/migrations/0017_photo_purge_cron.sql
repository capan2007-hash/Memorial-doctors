-- M4: imha edilecek fotoğrafları döndüren RPC + günlük süpürücü cron.
-- RPC yalnız service-role/definer tarafından; client'a kapalı.

create or replace function photos_due_purge()
returns table (photo_id uuid, storage_path text, tenant_id uuid, reason text)
language sql
security definer set search_path = public
as $$
  -- (a) not_completed: yüklemeden retention_days sonra
  select p.id, p.storage_path, p.tenant_id, 'retention_60d'
  from photo p
  join request r on r.id = p.request_id
  join tenant t on t.id = p.tenant_id
  where p.deleted_at is null and p.layer = 'active'
    and r.sale_status = 'not_completed'
    and now() > p.uploaded_at + make_interval(days => t.photo_retention_days)
  union all
  -- (b) operation_done: sale_marked_at + op_buffer_days sonra (aktif VEYA arşiv)
  select p.id, p.storage_path, p.tenant_id, 'operation_30d'
  from photo p
  join request r on r.id = p.request_id
  join tenant t on t.id = p.tenant_id
  where p.deleted_at is null
    and r.sale_status = 'operation_done'
    and r.sale_marked_at is not null
    and now() > r.sale_marked_at + make_interval(days => t.photo_op_buffer_days)
$$;
revoke execute on function photos_due_purge() from public, anon, authenticated;

-- Günlük süpürücü: photo-lifecycle fonksiyonunu sweep modunda çağırır.
create or replace function run_photo_lifecycle_sweep()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_secret text;
begin
  select value into v_secret from app_secret where name = 'notify_webhook_secret';
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://oxibdniwobetaksuxacs.supabase.co/functions/v1/photo-lifecycle',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('mode', 'sweep')
  );
exception when others then
  raise warning 'run_photo_lifecycle_sweep: %', sqlerrm;
end;
$$;
revoke execute on function run_photo_lifecycle_sweep() from public, anon, authenticated;

select cron.schedule('medtriage-photo-sweep', '0 3 * * *', 'select run_photo_lifecycle_sweep()');
