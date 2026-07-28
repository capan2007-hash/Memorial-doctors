-- ÇOKLU ALT KATEGORİ: bir talepte birden fazla işlem (ör. BBL + 360 Lipo + Meme Germe).
-- request.subcategory_id BİRİNCİL işlem olarak korunur (liste/başlık/mükerrer akışı onu
-- kullanır); tüm seçimler request_subcategory'de tutulur.
create table if not exists request_subcategory (
  request_id uuid not null references request(id) on delete cascade,
  subcategory_id uuid not null references subcategory(id),
  primary key (request_id, subcategory_id)
);

alter table request_subcategory enable row level security;

create policy req_sub_read on request_subcategory for select using (
  exists (select 1 from request r
          where r.id = request_subcategory.request_id and r.tenant_id = current_tenant_id())
);

create policy req_sub_write on request_subcategory for insert with check (
  exists (select 1 from request r
          where r.id = request_subcategory.request_id
            and r.tenant_id = current_tenant_id()
            and (r.created_by = auth.uid() or current_role_name() in ('coordinator', 'admin')))
);

-- assign_request_doctors: doktor, talebin ALT KATEGORİLERİNDEN HERHANGİ BİRİNE yetkinse atanır
-- (kategori düzeyi yetkinlik = tüm alt kategoriler). Tam gövde için Supabase migration
-- geçmişi: request_multi_subcategory.
