-- M?: content_translation PHI yönetişimi sertleştirme.
-- content_translation çevrilmiş hasta serbest-metnini (PHI) önbelleğe alır; şimdiye dek
-- tenant_id yoktu ve süresiz kalıyordu. Bu migration: (1) tenant scoping ekler,
-- (2) 90 günlük pg_cron retention süpürücüsü kurar (önbellek yeniden üretilebilir).

-- 1) Mevcut önbelleği temizle: tenant_id NOT NULL eklenebilsin diye (yeniden üretilebilir cache).
truncate content_translation;

-- 2) Tenant scoping.
alter table content_translation add column tenant_id uuid not null references tenant(id);

-- 3) Eski (tenant'sız) benzersizliği kaldır, tenant'a göre yenisini kur.
-- Eski constraint adı information_schema/pg_constraint ile teyit edildi:
-- content_translation_source_hash_target_lang_key (0043'teki `unique(source_hash, target_lang)`
-- table-level tanımından Postgres'in ürettiği varsayılan ad).
alter table content_translation drop constraint if exists content_translation_source_hash_target_lang_key;
alter table content_translation add constraint content_translation_tenant_source_target_key
  unique (tenant_id, source_hash, target_lang);

-- 4) Retention: 90 günden eski çeviri önbelleği kayıtlarını günlük süpür.
-- Silinen kayıtlar edge function tarafından yeniden üretilir → PHI ayak izini sınırlar.
create extension if not exists pg_cron;

create or replace function run_translation_retention()
returns void
language sql
security definer set search_path = public
as $$
  delete from content_translation where created_at < now() - interval '90 days';
$$;
revoke execute on function run_translation_retention() from public, anon, authenticated;

select cron.schedule('medtriage-translation-retention', '30 3 * * *', 'select run_translation_retention()');
