-- Aktivite Akışı: satışçı/acentaların girdiği ve doktorlara yönlendirilen (≥1 atama)
-- taleplerin akışı. sales/admin/super_admin görür; tenant = caller'ın kliniği.
-- Hasta PII dönmez — yalnız vaka türü + doktor sayısı (motivasyon sinyali).
create or replace function activity_timeline(p_limit int default 30, p_before timestamptz default null)
returns table(
  request_id uuid,
  created_at timestamptz,
  creator_name text,
  creator_role text,
  category_name text,
  subcategory_name text,
  doctor_count int
)
language sql
security definer
set search_path to 'public'
as $function$
  with me as (
    select tenant_id from app_user
    where id = auth.uid() and role in ('sales', 'admin', 'super_admin')
  )
  select
    r.id,
    r.created_at,
    coalesce(u.full_name, '—'),
    u.role::text,
    c.name,
    sc.name,
    (select count(*)::int from assignment a where a.request_id = r.id)
  from request r
  join me on r.tenant_id = me.tenant_id
  left join app_user u on u.id = r.created_by
  left join category c on c.id = r.category_id
  left join subcategory sc on sc.id = r.subcategory_id
  where (p_before is null or r.created_at < p_before)
    and exists (select 1 from assignment a where a.request_id = r.id)
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
$function$;

grant execute on function activity_timeline(int, timestamptz) to authenticated;
