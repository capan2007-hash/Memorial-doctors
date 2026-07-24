-- Faz 2 — Katalog i18n: category/subcategory/operation_type için name_i18n jsonb.
-- name sütunu kaynak (tr) olarak korunur; name_i18n nullable, geriye dönük uyumlu.
alter table category add column if not exists name_i18n jsonb;
alter table subcategory add column if not exists name_i18n jsonb;
alter table operation_type add column if not exists name_i18n jsonb;

-- Seed: TR (kaynak) / EN / AR çevirileri. Her update kendi tablosunda name'e göre eşleşir.

-- category (7)
update category set name_i18n = jsonb_build_object('tr', name, 'en', 'Limb Lengthening', 'ar', 'إطالة القامة') where name = 'Boy Uzatma';
update category set name_i18n = jsonb_build_object('tr', name, 'en', 'Dental Treatment', 'ar', 'علاج الأسنان') where name = 'Diş Tedavisi';
update category set name_i18n = jsonb_build_object('tr', name, 'en', 'Genital Aesthetics', 'ar', 'تجميل الأعضاء التناسلية') where name = 'Genital Estetik';
update category set name_i18n = jsonb_build_object('tr', name, 'en', 'Bariatric Surgery', 'ar', 'جراحة السمنة') where name = 'Obezite Cerrahisi';
update category set name_i18n = jsonb_build_object('tr', name, 'en', 'Penis Aesthetics', 'ar', 'تجميل القضيب') where name = 'Penis Estetiği';
update category set name_i18n = jsonb_build_object('tr', name, 'en', 'Plastic Surgery', 'ar', 'الجراحة التجميلية') where name = 'Plastik Cerrahi';
update category set name_i18n = jsonb_build_object('tr', name, 'en', 'Hair Transplant', 'ar', 'زراعة الشعر') where name = 'Saç Ekimi';

-- subcategory (7)
update subcategory set name_i18n = jsonb_build_object('tr', name, 'en', 'Rhinoplasty', 'ar', 'تجميل الأنف') where name = 'Burun estetiği';
update subcategory set name_i18n = jsonb_build_object('tr', name, 'en', 'ESG & POSE', 'ar', 'ESG & POSE') where name = 'ESG & POSE';
update subcategory set name_i18n = jsonb_build_object('tr', name, 'en', 'Gastric Sleeve', 'ar', 'تكميم المعدة') where name = 'Gastric Sleeve';
update subcategory set name_i18n = jsonb_build_object('tr', name, 'en', 'Breast Aesthetics', 'ar', 'تجميل الثدي') where name = 'Meme estetiği';
update subcategory set name_i18n = jsonb_build_object('tr', name, 'en', 'Revision Surgery', 'ar', 'جراحة المراجعة') where name = 'Revizyon Cerrahisi';
update subcategory set name_i18n = jsonb_build_object('tr', name, 'en', 'Body Aesthetics', 'ar', 'تجميل الجسم') where name = 'Vücut estetiği';
update subcategory set name_i18n = jsonb_build_object('tr', name, 'en', 'Facial Aesthetics', 'ar', 'تجميل الوجه') where name = 'Yüz estetiği';

-- operation_type (5)
update operation_type set name_i18n = jsonb_build_object('tr', name, 'en', '360 Lipo', 'ar', 'شفط دهون 360') where name = '360 Lipo';
update operation_type set name_i18n = jsonb_build_object('tr', name, 'en', 'FUE Hair Transplant', 'ar', 'زراعة شعر FUE') where name = 'FUE Saç Ekimi';
update operation_type set name_i18n = jsonb_build_object('tr', name, 'en', 'Tummy Tuck', 'ar', 'شد البطن') where name = 'Karın Germe';
update operation_type set name_i18n = jsonb_build_object('tr', name, 'en', 'Rhinoplasty', 'ar', 'تجميل الأنف') where name = 'Rinoplasti';
update operation_type set name_i18n = jsonb_build_object('tr', name, 'en', 'Gastric Sleeve', 'ar', 'تكميم المعدة') where name = 'Tüp Mide';
