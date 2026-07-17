-- photos bucket için Storage RLS: yalnız giriş yapmış kullanıcılar ve
-- yalnız kendi tenant'larının klasörü (path: <tenant_id>/<request_id>/<dosya>).
-- Böylece tenant izolasyonu Storage katmanında da sağlanır.

create policy "photos tenant insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = current_tenant_id()::text
  );

create policy "photos tenant select" on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = current_tenant_id()::text
  );
