-- Satışçı talep detayında "2 doktordan 2 yanıt · 1 bekleniyor" özetini gösterebilmek
-- için atama satırlarını okuyabilmeli. 0048'deki satış-grubu deseniyle aynı kapsam:
-- yalnız oluşturucusu sales/agent olan taleplerin atamaları. ADDITIVE (asg_read korunur).
create policy asg_sales_group_read on assignment for select using (
  tenant_id = current_tenant_id()
  and current_role_name() in ('sales', 'agent')
  and exists (
    select 1 from request r
    join app_user u on u.id = r.created_by
    where r.id = assignment.request_id
      and r.tenant_id = assignment.tenant_id
      and (
        -- agent yalnız KENDİ talebini; sales tüm satış grubunu görür (0048 ile tutarlı)
        (current_role_name() = 'agent' and r.created_by = auth.uid())
        or (current_role_name() = 'sales' and u.role in ('sales', 'agent'))
      )
  )
);
