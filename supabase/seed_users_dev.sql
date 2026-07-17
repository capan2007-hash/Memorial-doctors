-- DEV-ONLY test kullanıcıları. Yalnız pilot/geliştirme tenant'ı içindir.
-- Parola (hepsi): MedTriage2026!  — üretimde KULLANILMAZ; hesaplar admin tarafından davetle açılır.
-- auth.users + auth.identities doğrudan yazılır (dev seed). pgcrypto (extensions) gerekir.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000001','authenticated','authenticated','sales@rememore.test', extensions.crypt('MedTriage2026!', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', ''),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000002','authenticated','authenticated','agent@rememore.test', extensions.crypt('MedTriage2026!', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', ''),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000003','authenticated','authenticated','ayse@rememore.test', extensions.crypt('MedTriage2026!', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', ''),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000004','authenticated','authenticated','mehmet@rememore.test', extensions.crypt('MedTriage2026!', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', ''),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000005','authenticated','authenticated','koordinator@rememore.test', extensions.crypt('MedTriage2026!', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
 (gen_random_uuid(),'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', jsonb_build_object('sub','a0000000-0000-0000-0000-000000000001','email','sales@rememore.test'), 'email', now(), now(), now()),
 (gen_random_uuid(),'a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002', jsonb_build_object('sub','a0000000-0000-0000-0000-000000000002','email','agent@rememore.test'), 'email', now(), now(), now()),
 (gen_random_uuid(),'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003', jsonb_build_object('sub','a0000000-0000-0000-0000-000000000003','email','ayse@rememore.test'), 'email', now(), now(), now()),
 (gen_random_uuid(),'a0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000004', jsonb_build_object('sub','a0000000-0000-0000-0000-000000000004','email','mehmet@rememore.test'), 'email', now(), now(), now()),
 (gen_random_uuid(),'a0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000005', jsonb_build_object('sub','a0000000-0000-0000-0000-000000000005','email','koordinator@rememore.test'), 'email', now(), now(), now())
on conflict do nothing;

insert into app_user (id, tenant_id, role, full_name) values
 ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','sales','Satış Kullanıcı'),
 ('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','agent','Aracı Kullanıcı'),
 ('a0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','doctor','Dr. Ayşe'),
 ('a0000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','doctor','Dr. Mehmet'),
 ('a0000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','coordinator','Koordinatör')
on conflict (id) do nothing;

insert into doctor (tenant_id, app_user_id, title, specialty, category_id) values
 ('00000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','Op. Dr. Ayşe','Saç Ekimi','c1000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','Op. Dr. Mehmet','Saç Ekimi','c1000000-0000-0000-0000-000000000001')
on conflict do nothing;
