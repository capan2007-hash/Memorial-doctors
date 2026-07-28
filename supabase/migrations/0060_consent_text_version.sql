-- Onam kaydına, hastaya İLETİLEN aydınlatma metninin sürümü ve dili.
--
-- GEREKÇE: request.consent_at/consent_channel/consented_by (0022) onamın
-- ALINDIĞINI kaydediyor ama HANGİ METNE dayandığını kaydetmiyor. Metin
-- güncellendiğinde eski onamların neye dayandığı kanıtlanamaz hale geliyor.
--
-- consent_text_version: src/pages/legal/types.ts içindeki LEGAL_VERSION değeri.
-- consent_lang: satışçının hastaya gönderdiği metnin dili (SUPPORTED içinden).
--
-- NOT: Bu iki alanı istemci yazıyor — mevcut consent_at ile aynı güven düzeyinde.
-- Hastanın onamı KENDİ eylemiyle kaydetmek ayrı bir iş (bkz. spec §9.1).
alter table request add column if not exists consent_text_version text;
alter table request add column if not exists consent_lang text;

comment on column request.consent_text_version is
  'Hastaya iletilen aydınlatma metninin sürümü (LEGAL_VERSION). Eski satırlarda null.';
comment on column request.consent_lang is
  'Aydınlatma metninin hastaya iletildiği dil kodu (tr/ar/en/ru/de/fr). Eski satırlarda null.';
