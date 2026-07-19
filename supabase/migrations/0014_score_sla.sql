-- M3: skor motoru + SLA süpürücü (BRD §6.2, FR-24/25).
-- Kural=Veri: SLA süreleri tenant kolonu. Her atamaya EN FAZLA bir puan olayı
-- (unique assignment_id) — cron ile response trigger'ı yarışsa bile çift olay imkânsız.

alter table tenant add column sla_hours int not null default 24;
alter table tenant add column sla_reminder_hours int not null default 4;
alter table assignment add column reminder_sent_at timestamptz;

create table score_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  doctor_id uuid not null references doctor(id) on delete cascade,
  request_id uuid not null references request(id) on delete cascade,
  assignment_id uuid not null references assignment(id) on delete cascade unique,
  delta smallint not null check (delta in (-1, 1)),
  reason text not null check (reason in ('timely_response', 'sla_breach')),
  created_at timestamptz not null default now()
);
create index on score_event (tenant_id, doctor_id, created_at desc);

alter table score_event enable row level security;
-- Okuma: koordinatör/admin tüm tenant; doktor kendi olayları. Yazma: yalnız trigger/definer (client policy yok).
create policy score_event_read on score_event for select using (
  tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator', 'admin') or doctor_id = current_doctor_id()
  )
);

-- Trigger B: olaydan doctor.score güncelle (0-100 kelepçe; BRD tavan/taban kuralı).
create or replace function apply_score_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update doctor set score = greatest(0, least(100, score + new.delta)) where id = new.doctor_id;
  return new;
end;
$$;
create trigger trg_apply_score_event
after insert on score_event
for each row execute function apply_score_event();

-- Trigger A: yanıt gelince zamanında (+1) / geç (-1) puanla.
-- Cron aynı atamayı önceden cezalandırdıysa unique kısıt sayesinde no-op.
create or replace function score_on_response()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_assignment_id uuid;
  v_assigned_at timestamptz;
  v_tenant_id uuid;
  v_sla_hours int;
  v_delta smallint;
  v_reason text;
begin
  select a.id, a.assigned_at into v_assignment_id, v_assigned_at
  from assignment a
  where a.request_id = new.request_id and a.doctor_id = new.doctor_id
  limit 1;
  if v_assignment_id is null then return new; end if;

  select r.tenant_id into v_tenant_id from request r where r.id = new.request_id;
  select t.sla_hours into v_sla_hours from tenant t where t.id = v_tenant_id;
  if v_sla_hours is null then v_sla_hours := 24; end if;

  if new.responded_at <= v_assigned_at + make_interval(hours => v_sla_hours) then
    v_delta := 1; v_reason := 'timely_response';
  else
    v_delta := -1; v_reason := 'sla_breach';
  end if;

  insert into score_event (tenant_id, doctor_id, request_id, assignment_id, delta, reason)
  values (v_tenant_id, new.doctor_id, new.request_id, v_assignment_id, v_delta, v_reason)
  on conflict (assignment_id) do nothing;
  return new;
end;
$$;
create trigger trg_score_on_response
after insert on response
for each row execute function score_on_response();

-- SLA süpürücü: (a) süresi dolan yanıtsız atamalara -1; (b) pencereye giren
-- yanıtsız atamalara hatırlatma push'u (notify-sla, app_secret başlığıyla).
create or replace function run_sla_sweep()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_secret text;
  rec record;
begin
  -- (a) SLA aşımı cezaları
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

  -- (b) hatırlatmalar (yalnız pencere içinde: SLA'ya sla_reminder_hours kala, henüz aşılmamış)
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
  null; -- süpürücü hatası hiçbir akışı bozamaz; sonraki turda yeniden dener
end;
$$;

create extension if not exists pg_cron;
select cron.schedule('medtriage-sla-sweep', '*/15 * * * *', 'select run_sla_sweep()');
