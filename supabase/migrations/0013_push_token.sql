-- M6a: doktor push bildirimleri.
-- push_token: doktorun Expo push token'ları. app_secret: webhook doğrulama
-- sırrı gibi yalnız service-role'ün okuyacağı değerler (RLS açık, policy YOK).
-- Trigger: assignment INSERT'inde pg_net ile notify-assignment fonksiyonunu
-- asenkron çağırır — talep akışını bloke etmez, hata yutulur.

create extension if not exists pg_net;

create table push_token (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  doctor_id uuid not null references doctor(id) on delete cascade,
  expo_token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  unique (doctor_id, expo_token)
);

alter table push_token enable row level security;
create policy push_token_doctor_all on push_token for all using (
  tenant_id = current_tenant_id() and doctor_id = current_doctor_id()
) with check (
  tenant_id = current_tenant_id() and doctor_id = current_doctor_id()
  and current_role_name() = 'doctor'
);
create policy push_token_staff_read on push_token for select using (
  tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin')
);

create table app_secret (
  name text primary key,
  value text not null
);
alter table app_secret enable row level security; -- policy yok: yalnız service role

-- Değer migration'da DEĞİL (git'e girmesin); ayrıca elle eklenir:
--   insert into app_secret (name, value) values ('notify_webhook_secret', '<random>');

create or replace function notify_assignment_webhook()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  secret text;
begin
  select value into secret from app_secret where name = 'notify_webhook_secret';
  if secret is null then return new; end if;
  perform net.http_post(
    url := 'https://oxibdniwobetaksuxacs.supabase.co/functions/v1/notify-assignment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', secret
    ),
    body := jsonb_build_object('assignment_id', new.id)
  );
  return new;
exception when others then
  return new; -- bildirim hatası atama akışını asla durdurmaz
end;
$$;

create trigger trg_notify_assignment
after insert on assignment
for each row execute function notify_assignment_webhook();
