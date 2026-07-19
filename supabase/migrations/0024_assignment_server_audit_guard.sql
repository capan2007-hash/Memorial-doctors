-- P0-3/P0-4 (Fable analiz raporu): atama fan-out'u sunucuya iner, assignment
-- INSERT'i client'a kapanır (doktor kendini keyfi talebe atayamaz), audit_log
-- actor'ı sunucu belirler (kimlik sahteciliği imkânsızlaşır).

-- 1) Sunucu tarafı atama: resolveAssignees'in SQL karşılığı (birebir aynı kural:
--    kategori eşit VE alt kırılım null↔null ya da eşit; yalnız aktif doktorlar).
create or replace function assign_request_doctors(p_request_id uuid, p_type assignment_type default 'simultaneous')
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_req record;
  v_count int;
begin
  select r.* into v_req from request r
  where r.id = p_request_id and r.tenant_id = current_tenant_id();
  if v_req.id is null then
    raise exception 'talep bulunamadı';
  end if;
  -- Yetki: talebin sahibi (satışçı/aracı) veya koordinatör/admin.
  if not (v_req.created_by = auth.uid() or current_role_name() in ('coordinator', 'admin')) then
    raise exception 'atama yetkisi yok';
  end if;
  if v_req.status = 'closed' then
    raise exception 'kapanmış talep yeniden atanamaz';
  end if;

  insert into assignment (tenant_id, request_id, doctor_id, type)
  select v_req.tenant_id, v_req.id, d.id, p_type
  from doctor d
  where d.tenant_id = v_req.tenant_id and d.is_active
    and exists (
      select 1 from doctor_scope s
      where s.doctor_id = d.id
        and s.category_id = v_req.category_id
        and (
          (v_req.subcategory_id is null and s.subcategory_id is null)
          or s.subcategory_id = v_req.subcategory_id
        )
    )
  on conflict (request_id, doctor_id) do nothing;

  select count(*) into v_count from assignment a
  join doctor d on d.id = a.doctor_id
  where a.request_id = v_req.id and d.is_active;

  if v_count > 0 then
    update request set status = 'assigned', assigned_at = coalesce(assigned_at, now())
    where id = v_req.id and status <> 'closed';
  end if;

  -- Audit sunucudan, actor gerçek kimlik.
  insert into audit_log (tenant_id, actor_id, action, entity, after)
  values (v_req.tenant_id, auth.uid(),
          case when p_type = 'manual' then 'reassign' else 'assign' end,
          'request', jsonb_build_object('request_id', v_req.id, 'assigned', v_count));

  return v_count;
end;
$$;
revoke execute on function assign_request_doctors(uuid, assignment_type) from public, anon;
grant execute on function assign_request_doctors(uuid, assignment_type) to authenticated;

-- 2) assignment politikası sıkılaştırma: client INSERT/DELETE tamamen kapanır.
drop policy asg_doctor_rw on assignment;
create policy asg_read on assignment for select using (
  tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator', 'admin') or doctor_id = current_doctor_id()
  )
);
-- Doktor yalnız kendi satırını günceller (seen_at); kimlik/bağ kolonları trigger'la korunur.
create policy asg_doctor_update on assignment for update using (
  tenant_id = current_tenant_id() and doctor_id = current_doctor_id()
) with check (
  tenant_id = current_tenant_id() and doctor_id = current_doctor_id()
);

create or replace function guard_assignment_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Client (JWT'li) güncellemeleri bağ kolonlarını değiştiremez; service role serbest.
  if auth.uid() is not null and (
    new.request_id is distinct from old.request_id
    or new.doctor_id is distinct from old.doctor_id
    or new.tenant_id is distinct from old.tenant_id
    or new.type is distinct from old.type
    or new.assigned_at is distinct from old.assigned_at
  ) then
    raise exception 'atama bağ kolonları değiştirilemez';
  end if;
  return new;
end;
$$;
create trigger trg_guard_assignment_update
before update on assignment
for each row execute function guard_assignment_update();

-- 3) audit_log kimlik zorlaması: JWT'li her insert'te actor_id = auth.uid().
--    (Service role'de auth.uid() NULL — edge fn'lerin doğruladığı kimlik korunur.)
create or replace function force_audit_actor()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.actor_id := auth.uid();
  end if;
  return new;
end;
$$;
create trigger trg_force_audit_actor
before insert on audit_log
for each row execute function force_audit_actor();
