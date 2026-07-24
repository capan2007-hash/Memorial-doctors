-- Faz 1 — Web i18n: kullanıcının tercih ettiği arayüz dili.
-- Doğrudan app_user UPDATE RLS'i varsayılmaz; whitelist'li SECURITY DEFINER
-- RPC ile yalnızca kendi language alanı güncellenebilir.
alter table app_user add column if not exists language text not null default 'tr';

create or replace function set_my_language(p_lang text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_lang not in ('tr','ar','en','ru','de','fr') then
    raise exception 'gecersiz dil';
  end if;
  update app_user set language = p_lang where id = auth.uid();
end $$;
revoke execute on function set_my_language(text) from public, anon;
grant execute on function set_my_language(text) to authenticated;
