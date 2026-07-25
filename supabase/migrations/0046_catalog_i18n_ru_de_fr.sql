-- Faz 5: katalog adlarına RU + DE + FR çevirileri (mevcut tr/en/ar name_i18n'e ekle).
-- jsonb || ile birleştir → tr/en/ar korunur, ru/de/fr eklenir.

-- Kategoriler
update category set name_i18n = name_i18n || jsonb_build_object('ru','Удлинение конечностей','de','Beinverlängerung','fr','Allongement des membres') where name = 'Boy Uzatma';
update category set name_i18n = name_i18n || jsonb_build_object('ru','Стоматологическое лечение','de','Zahnbehandlung','fr','Traitement dentaire') where name = 'Diş Tedavisi';
update category set name_i18n = name_i18n || jsonb_build_object('ru','Генитальная эстетика','de','Genitalästhetik','fr','Esthétique génitale') where name = 'Genital Estetik';
update category set name_i18n = name_i18n || jsonb_build_object('ru','Бариатрическая хирургия','de','Adipositaschirurgie','fr','Chirurgie bariatrique') where name = 'Obezite Cerrahisi';
update category set name_i18n = name_i18n || jsonb_build_object('ru','Эстетика полового члена','de','Penisästhetik','fr','Esthétique pénienne') where name = 'Penis Estetiği';
update category set name_i18n = name_i18n || jsonb_build_object('ru','Пластическая хирургия','de','Plastische Chirurgie','fr','Chirurgie plastique') where name = 'Plastik Cerrahi';
update category set name_i18n = name_i18n || jsonb_build_object('ru','Пересадка волос','de','Haartransplantation','fr','Greffe de cheveux') where name = 'Saç Ekimi';

-- Alt kırılımlar
update subcategory set name_i18n = name_i18n || jsonb_build_object('ru','Ринопластика','de','Nasenkorrektur','fr','Rhinoplastie') where name = 'Burun estetiği';
update subcategory set name_i18n = name_i18n || jsonb_build_object('ru','ESG и POSE','de','ESG & POSE','fr','ESG & POSE') where name = 'ESG & POSE';
update subcategory set name_i18n = name_i18n || jsonb_build_object('ru','Рукавная гастропластика','de','Schlauchmagen','fr','Sleeve gastrique') where name = 'Gastric Sleeve';
update subcategory set name_i18n = name_i18n || jsonb_build_object('ru','Эстетика груди','de','Brustästhetik','fr','Esthétique mammaire') where name = 'Meme estetiği';
update subcategory set name_i18n = name_i18n || jsonb_build_object('ru','Ревизионная хирургия','de','Revisionschirurgie','fr','Chirurgie de révision') where name = 'Revizyon Cerrahisi';
update subcategory set name_i18n = name_i18n || jsonb_build_object('ru','Эстетика тела','de','Körperästhetik','fr','Esthétique corporelle') where name = 'Vücut estetiği';
update subcategory set name_i18n = name_i18n || jsonb_build_object('ru','Эстетика лица','de','Gesichtsästhetik','fr','Esthétique du visage') where name = 'Yüz estetiği';

-- Operasyon tipleri
update operation_type set name_i18n = name_i18n || jsonb_build_object('ru','Липосакция 360','de','360-Liposuktion','fr','Lipo 360') where name = '360 Lipo';
update operation_type set name_i18n = name_i18n || jsonb_build_object('ru','Пересадка волос FUE','de','FUE-Haartransplantation','fr','Greffe de cheveux FUE') where name = 'FUE Saç Ekimi';
update operation_type set name_i18n = name_i18n || jsonb_build_object('ru','Абдоминопластика','de','Bauchdeckenstraffung','fr','Abdominoplastie') where name = 'Karın Germe';
update operation_type set name_i18n = name_i18n || jsonb_build_object('ru','Ринопластика','de','Nasenkorrektur','fr','Rhinoplastie') where name = 'Rinoplasti';
update operation_type set name_i18n = name_i18n || jsonb_build_object('ru','Рукавная гастропластика','de','Schlauchmagen','fr','Sleeve gastrique') where name = 'Tüp Mide';
