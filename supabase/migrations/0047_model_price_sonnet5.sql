-- Billing: translate (içerik çevirisi) fonksiyonu claude-sonnet-5 kullanıyor ama
-- model_price'ta yalnız claude-opus-4-8 vardı → çeviri maliyeti hesaplanamıyordu.
-- Sonnet-5 fiyatını ekle. TANITIM fiyatı (2026-08-31'e kadar): $2 girdi / $10 çıktı /Mtok.
-- NOT: 2026-09-01'den itibaren standart fiyat $3 / $15 olur → o tarihte bu satırı
-- güncelle (update model_price set input_usd_per_mtok=3, output_usd_per_mtok=15 ...).
-- Cache çarpanları Anthropic standardı: yazma 1.25×, okuma 0.10× (opus ile aynı).
insert into model_price (model, input_usd_per_mtok, output_usd_per_mtok, cache_write_multiplier, cache_read_multiplier)
values ('claude-sonnet-5', 2, 10, 1.25, 0.10)
on conflict (model) do update set
  input_usd_per_mtok = excluded.input_usd_per_mtok,
  output_usd_per_mtok = excluded.output_usd_per_mtok,
  cache_write_multiplier = excluded.cache_write_multiplier,
  cache_read_multiplier = excluded.cache_read_multiplier,
  updated_at = now();
