-- M2: AI dahili triyaj değerlendirmeleri + doktor geri bildirimi
create type ai_status as enum ('ok','warning','failed');
create type ai_feedback_label as enum ('correct','partial','wrong');

create table ai_evaluation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  status ai_status not null,
  warnings jsonb not null default '[]',
  suitability_note text,
  disclaimer text not null,
  model text not null,
  model_version text,
  error text,
  created_at timestamptz not null default now(),
  unique (request_id)
);
create index on ai_evaluation (tenant_id, request_id);

create table ai_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  ai_evaluation_id uuid not null references ai_evaluation(id) on delete cascade,
  doctor_id uuid not null references doctor(id),
  label ai_feedback_label not null,
  note text,
  created_at timestamptz not null default now(),
  unique (ai_evaluation_id, doctor_id)
);
create index on ai_feedback (tenant_id, created_at desc);

alter table ai_evaluation enable row level security;
alter table ai_feedback enable row level security;

-- Okuma: doktor (kendisine atanan talep) + sales + coordinator/admin. AGENT OKUYAMAZ (FR-8/sapma-2).
create policy ai_eval_read on ai_evaluation for select using (
  tenant_id = current_tenant_id() and (
    current_role_name() in ('sales','coordinator','admin')
    or request_id in (select request_id from assignment where doctor_id = current_doctor_id())
  )
);
-- Yazma: yalnız service role (client policy yok; service role RLS'i bypass eder).

create policy ai_fb_doctor_insert on ai_feedback for insert with check (
  tenant_id = current_tenant_id() and doctor_id = current_doctor_id()
  and current_role_name() = 'doctor'
);
create policy ai_fb_read on ai_feedback for select using (
  tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator','admin') or doctor_id = current_doctor_id()
  )
);
