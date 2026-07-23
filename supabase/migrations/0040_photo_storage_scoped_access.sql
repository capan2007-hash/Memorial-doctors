-- Denetim K1: storage `photos` SELECT politikası tenant-içi aşırı erişimi kapatır.
-- Eski politika ("photos tenant select") tenant'taki HERKESE her objeyi doğrudan
-- imzalama (createSignedUrl) izni veriyordu → arşiv katmanı photo-url edge fn'inin
-- yetki+audit denetimini ve çapraz-atama aktif fotoları baypas ediliyordu.
--
-- Yeni: can_read_photo_object() yardımcısıyla rol + talep kapsamı:
--   • koordinatör/admin/super_admin → tam tenant erişimi
--   • doktor → yalnız atandığı talebin AKTİF fotosu + kendi profil fotosu
--   • sales/agent → yalnız oluşturduğu talebin AKTİF fotosu
--   • arşiv katmanı → DAİMA reddedilir (yalnız photo-url edge fn'i, audit'li)
--
-- Doğrulandı (fonksiyon düzeyi, 9/9 senaryo): koordinatör→true, atanan doktor→true,
-- atanmamış doktor→false, oluşturan sales→true, başka agent→false, doktor kendi
-- fotosu→true, sales başka doktor fotosu→false, yabancı tenant→false.

create or replace function can_read_photo_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  v_role user_role;
  v_uid uuid;
  v_layer text;
  v_request_id uuid;
  v_doctor_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return false; end if;

  parts := string_to_array(object_name, '/');
  if parts[1] is null or parts[1] <> current_tenant_id()::text then return false; end if;

  v_role := current_role_name();
  if v_role in ('coordinator', 'admin', 'super_admin') then return true; end if;

  -- Doktor profil fotosu: <tenant>/doctors/<doctor_id>/... — yalnız kendi.
  if parts[2] = 'doctors' then
    return exists (select 1 from doctor d where d.id::text = parts[3] and d.app_user_id = v_uid);
  end if;

  -- Hasta fotosu: <tenant>/<request_id>/<file> — yalnız AKTİF katman doğrudan imzalanabilir.
  select p.layer::text, p.request_id into v_layer, v_request_id
    from photo p where p.storage_path = object_name limit 1;
  if not found then return false; end if;
  if v_layer <> 'active' then return false; end if;

  -- Doktor: atandığı talep.
  select d.id into v_doctor_id from doctor d where d.app_user_id = v_uid limit 1;
  if v_doctor_id is not null and exists (
    select 1 from assignment a where a.request_id = v_request_id and a.doctor_id = v_doctor_id
  ) then
    return true;
  end if;

  -- Sales/agent: oluşturduğu talep.
  if exists (select 1 from request r where r.id = v_request_id and r.created_by = v_uid) then
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function can_read_photo_object(text) from public, anon;
grant execute on function can_read_photo_object(text) to authenticated;

-- Açık politikayı kapsamlı olanla değiştir.
drop policy if exists "photos tenant select" on storage.objects;

create policy "photos scoped select" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and can_read_photo_object(name));
