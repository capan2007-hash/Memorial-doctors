-- Talebin toplam durumu (offers_ready / escalated / in_review) türetilmiş veridir
-- ve response değişimlerinden server-side hesaplanır. Client (doktor) request
-- tablosunu güncelleyemez (RLS'te doktorun UPDATE yetkisi yok), bu yüzden durum
-- geçişi bir trigger ile yapılır. Mantık domain/decision.ts aggregateStatus ile aynıdır:
--   - en az bir kabul  -> offers_ready
--   - atanan tüm doktorlar red -> escalated
--   - aksi halde -> in_review
create or replace function recompute_request_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rid uuid := coalesce(NEW.request_id, OLD.request_id);
  assigned_count int;
  accept_count int;
  reject_count int;
  cur_status request_status;
  new_status request_status;
begin
  select status into cur_status from request where id = rid;
  -- taslak/gönderildi/kapandı durumlarını değiştirme
  if cur_status is null or cur_status in ('draft','submitted','closed') then
    return coalesce(NEW, OLD);
  end if;

  select count(*) into assigned_count from assignment where request_id = rid;
  select count(*) filter (where decision = 'accept') into accept_count
    from response where request_id = rid;
  select count(distinct r.doctor_id) into reject_count
    from response r
    join assignment a on a.request_id = r.request_id and a.doctor_id = r.doctor_id
    where r.request_id = rid and r.decision = 'reject';

  if accept_count > 0 then
    new_status := 'offers_ready';
  elsif assigned_count > 0 and reject_count >= assigned_count then
    new_status := 'escalated';
  else
    new_status := 'in_review';
  end if;

  update request set status = new_status where id = rid and status <> new_status;
  return coalesce(NEW, OLD);
end $$;

create trigger trg_response_recompute
after insert or update or delete on response
for each row execute function recompute_request_status();
