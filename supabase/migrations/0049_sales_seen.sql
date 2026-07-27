-- Bekleyen alarmı (rozet): satışçının HENÜZ BAKMADIĞI doktor yanıtlarını sayabilmek
-- için talep bazlı "görüldü" damgası. Satış tarafı ortak çalıştığından kişi-bazlı
-- değil TALEP-bazlıdır: satış grubundan biri detayı açtıysa talep görülmüş sayılır.
alter table request add column if not exists sales_seen_at timestamptz;

-- Görüldü işaretleme: doğrudan UPDATE vermek yerine (request UPDATE'i status
-- trigger'ıyla korunuyor) dar kapsamlı SECURITY DEFINER RPC. Yalnız bu kolonu yazar.
create or replace function mark_request_seen(p_request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Yalnız satış/koordinasyon rolleri ve yalnız KENDİ tenant'ındaki talep.
  if current_role_name() not in ('sales', 'agent', 'coordinator', 'admin', 'super_admin') then
    return; -- doktor vb. için sessiz no-op (akışı bozmaz)
  end if;
  update request
    set sales_seen_at = now()
  where id = p_request_id
    and tenant_id = current_tenant_id();
end;
$$;

revoke execute on function mark_request_seen(uuid) from public, anon;
grant execute on function mark_request_seen(uuid) to authenticated;
