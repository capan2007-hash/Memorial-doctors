-- Doktor Panel: caller doktorun aynı klinikteki (tenant) aktif doktorlar arasında
-- puan ve ortalama yanıt süresi bakımından sırasını döner. Yalnız caller'ın sırası +
-- toplam sayı döner; başka doktorun kimliği/verisi sızmaz. avg_mins hesabı
-- own_doctor_performance ile birebir aynıdır (response↔assignment, responded_at >= assigned_at).
create or replace function own_doctor_ranks()
returns table(
  score_rank int, score_total int, score_pct int,
  response_rank int, response_total int, response_pct int
)
language sql
security definer
set search_path to 'public'
as $function$
  with me as (
    select id, tenant_id from doctor
    where id = current_doctor_id() and current_role_name() = 'doctor'
  ),
  active_docs as (
    select d.id, d.score,
      (select round(avg(extract(epoch from (r.responded_at - a.assigned_at)) / 60.0)::numeric, 1)
        from response r
        join assignment a on a.request_id = r.request_id and a.doctor_id = r.doctor_id
        where r.doctor_id = d.id and r.responded_at >= a.assigned_at) as avg_mins
    from doctor d
    where d.is_active = true
      and d.tenant_id = (select tenant_id from me)
  ),
  score_ranked as (
    select id,
      rank() over (order by score desc) as rk,
      count(*) over () as total
    from active_docs
  ),
  resp_ranked as (
    select id,
      rank() over (order by avg_mins asc) as rk,
      count(*) over () as total
    from active_docs
    where avg_mins is not null
  )
  select
    sr.rk::int,
    sr.total::int,
    ceil(sr.rk::numeric / nullif(sr.total, 0) * 100)::int,
    rr.rk::int,
    coalesce(rr.total, 0)::int,
    ceil(rr.rk::numeric / nullif(rr.total, 0) * 100)::int
  from me
  left join score_ranked sr on sr.id = me.id
  left join resp_ranked rr on rr.id = me.id
$function$;

grant execute on function own_doctor_ranks() to authenticated;
