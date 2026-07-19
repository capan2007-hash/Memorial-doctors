-- Doktor performans panosu (FR-29b): tüm doktorların metriklerini tek sorguda.
-- Skor kümülatif (güncel); kabul/red/zamanında/geç/ort. yanıt tarih aralığıyla
-- filtrelenir (p_from/p_to NULL → tüm zaman). Bekleyen atama güncel durumdur.
-- SECURITY DEFINER: içeride rol + tenant kontrolü (yalnız koordinatör/admin).

create or replace function doctor_performance_summary(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  doctor_id uuid,
  title text,
  specialty text,
  score int,
  is_active boolean,
  accept_count bigint,
  reject_count bigint,
  avg_response_mins numeric,
  timely_count bigint,
  breach_count bigint,
  pending_count bigint
)
language sql
security definer set search_path = public
as $$
  select
    d.id, d.title, d.specialty, d.score, d.is_active,
    coalesce((select count(*) from response r
      where r.doctor_id = d.id and r.decision = 'accept'
        and (p_from is null or r.responded_at >= p_from)
        and (p_to is null or r.responded_at <= p_to)), 0),
    coalesce((select count(*) from response r
      where r.doctor_id = d.id and r.decision = 'reject'
        and (p_from is null or r.responded_at >= p_from)
        and (p_to is null or r.responded_at <= p_to)), 0),
    (select round(avg(extract(epoch from (r.responded_at - a.assigned_at)) / 60.0)::numeric, 1)
      from response r
      join assignment a on a.request_id = r.request_id and a.doctor_id = r.doctor_id
      where r.doctor_id = d.id and r.responded_at >= a.assigned_at
        and (p_from is null or r.responded_at >= p_from)
        and (p_to is null or r.responded_at <= p_to)),
    coalesce((select count(*) from score_event se
      where se.doctor_id = d.id and se.reason = 'timely_response'
        and (p_from is null or se.created_at >= p_from)
        and (p_to is null or se.created_at <= p_to)), 0),
    coalesce((select count(*) from score_event se
      where se.doctor_id = d.id and se.reason = 'sla_breach'
        and (p_from is null or se.created_at >= p_from)
        and (p_to is null or se.created_at <= p_to)), 0),
    coalesce((select count(*) from assignment a
      join request req on req.id = a.request_id
      where a.doctor_id = d.id and req.status <> 'closed'
        and not exists (select 1 from response r2 where r2.request_id = a.request_id and r2.doctor_id = d.id)), 0)
  from doctor d
  where d.tenant_id = current_tenant_id()
    and current_role_name() in ('coordinator', 'admin')
  order by d.score desc, d.title
$$;
revoke execute on function doctor_performance_summary(timestamptz, timestamptz) from public, anon;
grant execute on function doctor_performance_summary(timestamptz, timestamptz) to authenticated;
