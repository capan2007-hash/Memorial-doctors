-- M5 savunma derinliği: talep artık client'ın verdiği patient_id ile bağlanabiliyor
-- (mükerrer "aynı hasta" akışı). Hastanın talebin tenant'ına ait olduğunu DB'de doğrula
-- — pratikte istismar edilemez (yabancı UUID keşfi yok) ama bütünlük garantisi.
create or replace function guard_request_patient_tenant()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from patient p where p.id = new.patient_id and p.tenant_id = new.tenant_id
  ) then
    raise exception 'patient_id talebin tenant''ına ait değil';
  end if;
  return new;
end;
$$;
create trigger trg_guard_request_patient_tenant
before insert on request
for each row execute function guard_request_patient_tenant();
