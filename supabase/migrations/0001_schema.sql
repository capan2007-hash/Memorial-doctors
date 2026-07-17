-- Enums
create type user_role as enum ('agent','sales','doctor','coordinator','admin');
create type request_status as enum ('draft','submitted','assigned','in_review','offers_ready','escalated','closed');
create type sale_status as enum ('not_completed','sale_done','operation_done');
create type assignment_type as enum ('simultaneous','manual');
create type decision_type as enum ('accept','reject');
create type photo_layer as enum ('active','archive');

create table tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table app_user (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenant(id),
  role user_role not null,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table category (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  name text not null,
  has_subcategories boolean not null default false,
  assignment_mode text not null default 'simultaneous'
);

create table subcategory (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references category(id) on delete cascade,
  name text not null
);

create table operation_type (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references category(id) on delete cascade,
  subcategory_id uuid references subcategory(id) on delete cascade,
  name text not null
);

create table doctor (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  app_user_id uuid references app_user(id),
  photo_url text,
  title text,
  specialty text,
  category_id uuid not null references category(id),
  subcategory_id uuid references subcategory(id),
  bio text,
  weighted_work jsonb not null default '[]',
  score int not null default 100,
  is_active boolean not null default true
);

create table patient (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table request (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  patient_id uuid not null references patient(id),
  created_by uuid not null references app_user(id),
  category_id uuid not null references category(id),
  subcategory_id uuid references subcategory(id),
  operation_type_id uuid references operation_type(id),
  notes text,
  status request_status not null default 'draft',
  sale_status sale_status not null default 'not_completed',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  assigned_at timestamptz
);

create table photo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  layer photo_layer not null default 'active'
);

create table assignment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  doctor_id uuid not null references doctor(id),
  type assignment_type not null default 'simultaneous',
  assigned_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (request_id, doctor_id)
);

create table response (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  doctor_id uuid not null references doctor(id),
  decision decision_type not null,
  reject_reason text,
  treatment_plan text,
  responded_at timestamptz not null default now(),
  unique (request_id, doctor_id),
  check (decision = 'accept' or reject_reason is not null)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  actor_id uuid references app_user(id),
  action text not null,
  entity text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index on request (tenant_id, status);
create index on assignment (doctor_id, seen_at);
create index on response (request_id);
create index on doctor (tenant_id, category_id, subcategory_id);
