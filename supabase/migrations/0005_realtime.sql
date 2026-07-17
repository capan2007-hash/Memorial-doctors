-- Doktor bekleyen sayacının canlı güncellenmesi için assignment tablosunu
-- Realtime yayınına ekle. RLS realtime'da da geçerlidir: doktor yalnız kendi
-- assignment satırlarının değişimini alır.
alter publication supabase_realtime add table assignment;
