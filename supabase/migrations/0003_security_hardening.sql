-- Kullanıcı kendi tenant'ını okuyabilir (tenant tablosu RLS'i için politika)
create policy tenant_read_self on tenant for select
  using (id = current_tenant_id());

-- Helper fonksiyonlar SECURITY DEFINER; yalnız giriş yapmış kullanıcılar çağırabilsin.
-- anon/public üzerinden RPC ile çağrılmalarını engelle (auth.uid() zaten null döner
-- ama exposed API yüzeyini daraltmak sağlık verisi için doğru olandır).
revoke execute on function current_tenant_id() from public, anon;
revoke execute on function current_role_name() from public, anon;
revoke execute on function current_doctor_id() from public, anon;
grant execute on function current_tenant_id() to authenticated;
grant execute on function current_role_name() to authenticated;
grant execute on function current_doctor_id() to authenticated;
