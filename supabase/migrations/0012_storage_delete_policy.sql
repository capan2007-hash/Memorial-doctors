-- Koordinatör/admin kendi tenant'ının fotoğraflarını silebilsin.
-- Gerekçe: test verisi temizliği + ileride KVKK silme talepleri (M4/P2).
-- Diğer roller silemez; tenant izolasyonu path'in ilk klasörüyle korunur.
create policy "photos staff delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = current_tenant_id()::text
    and current_role_name() in ('coordinator', 'admin')
  );
