-- P0-4 düzeltme: audit_log yazımı tamamen sunucu tarafına alınır.
-- Bulgu: client audit insert'i zaten yalnız koordinatör/admin'de çalışıyordu
-- (satışçı/doktor sessizce 42501 alıyordu — latent hata) ve actor client
-- kontrolündeydi (sahtecilik). Çözüm: client'ın audit INSERT'ini tümden kapat,
-- meşru audit'leri SECURITY DEFINER trigger'larla üret (actor = gerçek auth.uid()).

-- Deneysel olarak devre dışı bıraktığım geçici trigger'ı ve artık gereksiz
-- force-actor mekanizmasını kaldır (client hiç yazamayacağı için gerek yok).
drop trigger if exists trg_force_audit_actor on audit_log;
drop function if exists force_audit_actor();

-- Client'ın doğrudan audit yazmasını kapat (yalnız service role + SECURITY DEFINER
-- fonksiyon/trigger'lar RLS'i baypas ederek yazar).
drop policy if exists audit_write on audit_log;

-- Satış durumu değişimi audit'i (eski useSetSaleStatus client yazımı yerine).
create or replace function audit_sale_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into audit_log (tenant_id, actor_id, action, entity, before, after)
  values (new.tenant_id, auth.uid(), 'sale_status_change', 'request',
          jsonb_build_object('sale_status', old.sale_status),
          jsonb_build_object('request_id', new.id, 'sale_status', new.sale_status));
  return new;
end;
$$;
create trigger trg_audit_sale_status
after update of sale_status on request
for each row when (old.sale_status is distinct from new.sale_status)
execute function audit_sale_status_change();

-- Doktor profili güncellemesi audit'i (eski useUpdateDoctor client yazımı yerine).
-- Yalnız profil kolonları; score (apply_score_event ile sık değişir) hariç.
create or replace function audit_doctor_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into audit_log (tenant_id, actor_id, action, entity, after)
  values (new.tenant_id, auth.uid(), 'doctor_update', 'doctor',
          jsonb_build_object('doctor_id', new.id));
  return new;
end;
$$;
create trigger trg_audit_doctor_update
after update of title, specialty, bio, weighted_work, is_active, photo_url on doctor
for each row execute function audit_doctor_update();
