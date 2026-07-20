-- Kullanıcı Yönetimi (spec 2026-07-20): liste gösterimi için app_user'a email
-- (kaynak auth.users; edge fn senkron yazar). Mevcut satırlar backfill.
alter table app_user add column email text;
update app_user au set email = u.email from auth.users u where u.id = au.id;
