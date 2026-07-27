-- Fiyat teklifi akışı: satışçı doktor yanıtlarını görüp hastaya teklif iletir.
-- Yeni ara durum: not_completed → offer_sent → sale_done → operation_done
-- NOT: enum değeri AYRI migration'da eklenir; aynı işlem içinde KULLANILAMAZ (Postgres).
alter type sale_status add value if not exists 'offer_sent' after 'not_completed';
