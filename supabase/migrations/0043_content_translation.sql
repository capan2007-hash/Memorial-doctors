alter table request add column if not exists source_lang text not null default 'tr';
alter table response add column if not exists source_lang text not null default 'tr';

create table if not exists content_translation (
  id uuid primary key default gen_random_uuid(),
  source_hash text not null,
  source_lang text not null,
  target_lang text not null,
  translated_text text not null,
  created_at timestamptz not null default now(),
  unique (source_hash, target_lang)
);
alter table content_translation enable row level security;
-- Doğrudan client erişimi yok: hiçbir policy tanımlanmaz → authenticated/anon 0 satır.
-- Edge function service-role ile erişir (RLS bypass).
