-- M4: KVKK fotoğraf yaşam döngüsü (BRD §7.8, FR-30b..FR-39).
-- Kural=Veri: retention süreleri tenant ayarı.

alter table tenant add column photo_retention_days int not null default 60
  constraint tenant_photo_retention_positive check (photo_retention_days > 0);
alter table tenant add column photo_op_buffer_days int not null default 30
  constraint tenant_photo_op_buffer_positive check (photo_op_buffer_days > 0);

alter table request add column sale_marked_at timestamptz;

-- İmha sonrası satır KALIR (silinmişlik metadata'sı — FR-39).
alter table photo add column deleted_at timestamptz;
alter table photo add column deletion_reason text;

-- FR-36: arşiv katmanı satır düzeyinde de agent/sales'e kapalı.
-- (creator yalnız aktif katmanı görür; koordinatör/admin ve atanan doktor her katmanı.)
drop policy photo_read on photo;
create policy photo_read on photo for select
  using (tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator', 'admin')
    or request_id in (select request_id from assignment where doctor_id = current_doctor_id())
    or (layer = 'active' and request_id in (select id from request where created_by = auth.uid()))
  ));

-- operation_done yalnız koordinatör/admin tarafından set edilebilir (FR-34).
create or replace function guard_sale_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.sale_status = 'operation_done' and old.sale_status is distinct from 'operation_done'
     and current_role_name() not in ('coordinator', 'admin') then
    raise exception 'operation_done yalnız koordinatör/admin tarafından işaretlenebilir';
  end if;
  if new.sale_status is distinct from old.sale_status then
    new.sale_marked_at := now();
  end if;
  return new;
end;
$$;
create trigger trg_guard_sale_status
before update of sale_status on request
for each row execute function guard_sale_status();
