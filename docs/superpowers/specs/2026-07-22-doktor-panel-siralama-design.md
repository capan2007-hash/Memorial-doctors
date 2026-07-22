# Doktor Panel (Dashboard) + Sıralama — Tasarım

**Tarih:** 2026-07-22
**Kapsam:** Mobil doktor uygulaması (`mobile/`). Web dışında.

## Amaç
Mobil doktor uygulamasında bugün tek "Profil" ekranında birleşik olan **raporlama (Performansım)** ile **profil düzenleme + yetkinlikler**'i **iki ayrı ekrana** ayırmak; yeni **Panel (Dashboard)** ekranında doktorun kendi metriklerine ek olarak **puan** ve **ortalama cevaplama süresi** bakımından tüm (aktif) doktorlar arasındaki **sırasını** göstermek.

## Navigasyon
Alt tab çubuğu 4 → **5 tab**: **Bekleyen · Geçmiş · Panel · Profil · Ayarlar**.
- Yeni `dashboard.tsx`, Geçmiş ile Profil arasına eklenir. İkon: lucide `BarChart3`.
- `profile.tsx`'ten **Performansım** kartı çıkar; Profil'de yalnız *Profil* + *Yetkinlikler* kalır.

## Panel ekranı
İki kart:
1. **Performansım** — mevcut 6 kutu aynen taşınır: Skor · Gelen · Cevaplanan · Ort. yanıt · Zamanında · Hedef dışı.
2. **Sıralamam** (yeni) — iki satır:
   - **Puan sırası:** `rank / total` + "üst %X" + tier rengi.
   - **Yanıt hızı sırası:** `rank / total` + "üst %X" + tier rengi.
   - Kıyas kümesi: aynı kliniğin (tenant) `is_active = true` doktorları.
   - Tier: üst ⅓ → success (yeşil), orta ⅓ → warning (amber), alt ⅓ → danger (kırmızı).
   - `total < 2` → yüzdelik yerine "Kıyas için yeterli doktor yok".
   - Caller hiç yanıtlamadıysa (avg = null) → yanıt sırası "Henüz yanıt yok".

## Sıralama RPC — `own_doctor_ranks()`
SECURITY DEFINER, `search_path = public`, rol guard `current_role_name() = 'doctor'`, tenant caller'ın `doctor` satırından çözülür. **Yalnız caller'ın sırası + toplam döner; başka doktorun kimliği/verisi dönmez.**

Dönen sütunlar (tek satır):
`score_rank int, score_total int, score_pct int, response_rank int, response_total int, response_pct int`
(caller aktif değilse veya yanıtı yoksa ilgili alanlar `null`.)

Hesap:
- **active_docs:** tenant içindeki `is_active` doktorlar; her biri için `avg_mins` = `own_doctor_performance` ile **aynı** formül (response↔assignment join, `responded_at ≥ assigned_at`).
- **score_rank:** `rank() over (order by score desc)`; `total` = aktif doktor sayısı.
- **response_rank:** `rank() over (order by avg_mins asc)` yalnız `avg_mins is not null` olanlar arasında; `total` = yanıtı olan doktor sayısı.
- **pct:** `ceil(rank / nullif(total,0) * 100)`.
- Beraberlik: `rank()` (aynı değer aynı sırayı paylaşır).

`grant execute ... to authenticated`.

## Dosyalar
- `supabase/migrations/0037_own_doctor_ranks.sql` — yeni RPC + grant.
- `mobile/src/domain/rank.ts` (+ `__tests__/rank.test.ts`) — `topPercentLabel`, `rankTier`, `comparable`.
- `mobile/src/features/profile/useOwnProfile.ts` — `OwnRanks` tipi + `useOwnRanks()` hook.
- `mobile/src/app/(tabs)/dashboard.tsx` — yeni Panel ekranı (Performansım + Sıralamam kartları).
- `mobile/src/app/(tabs)/_layout.tsx` — Panel tab'ı (BarChart3).
- `mobile/src/app/(tabs)/profile.tsx` — Performansım kartı ve ilgili kullanılmayan importlar çıkarılır.

## Doğrulama
- `npx tsc --noEmit` (mobil) = 0 hata; `jest` rank testleri geçer.
- RPC canlı SQL ile doğrulanır (rank değerleri elle kontrol).
- iOS simülatöründe Panel + Profil ekranları görsel doğrulanır.
