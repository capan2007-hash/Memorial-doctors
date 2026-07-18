-- Review düzeltmesi: doktor geri bildirimi yalnız kendi atandığı talebin,
-- kendi tenant'ındaki değerlendirmesine yazılabilir; request_id ile
-- evaluation.request_id tutarlı olmak zorunda. Aksi halde doktor UUID
-- tahminiyle yabancı tenant değerlendirmesine feedback yazıp FR-53
-- ipuçları üzerinden cross-tenant sızıntı oluşturabilirdi.
drop policy ai_fb_doctor_insert on ai_feedback;
create policy ai_fb_doctor_insert on ai_feedback for insert with check (
  tenant_id = current_tenant_id()
  and doctor_id = current_doctor_id()
  and current_role_name() = 'doctor'
  and exists (
    select 1 from ai_evaluation e
    where e.id = ai_evaluation_id
      and e.tenant_id = current_tenant_id()
      and e.request_id = ai_feedback.request_id
  )
  and request_id in (select request_id from assignment where doctor_id = current_doctor_id())
);
