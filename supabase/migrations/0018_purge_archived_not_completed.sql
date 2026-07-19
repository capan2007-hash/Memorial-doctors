-- M4 review düzeltmesi (KVKK açığı): sale_done → not_completed'a dönen fotoğraf
-- arşiv katmanında kalıyordu ve hiçbir imha dalına uymadığından SÜRESİZ saklanıyordu.
-- not_completed dalından layer='active' koşulunu kaldırıyoruz: sale_done fotoğrafları
-- zaten sale_status ile ayrışıp korunur; not_completed her katmanda 60 gün sonra imha edilir.

create or replace function photos_due_purge()
returns table (photo_id uuid, storage_path text, tenant_id uuid, reason text)
language sql
security definer set search_path = public
as $$
  select p.id, p.storage_path, p.tenant_id, 'retention_60d'
  from photo p
  join request r on r.id = p.request_id
  join tenant t on t.id = p.tenant_id
  where p.deleted_at is null
    and r.sale_status = 'not_completed'
    and now() > p.uploaded_at + make_interval(days => t.photo_retention_days)
  union all
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
