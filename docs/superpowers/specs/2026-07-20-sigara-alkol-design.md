# Sigara & Alkol Kullanımı — Tasarım Spesifikasyonu

**Tarih:** 2026-07-20 · **Durum:** Onaylandı (kullanıcı) · **Kapsam:** Talep formuna hastanın sigara/alkol kullanımını *miktarıyla* eklemek; AI ön-triyaja risk girdisi vermek; doktora göster

## Amaç
Cerrahi/anestezi riski için "evet/hayır" yetersiz — miktar gerekir. Klinik ölçütler: sigarada **paket-yıl** (pack-years = adet/gün ÷ 20 × yıl), alkolde **haftalık standart içki**. Bu veriler AI ön-triyajın yara iyileşmesi/anestezi/kanama risk değerlendirmesini besler.

## Kilit Kararlar (onaylandı)
- **Tam klinik hassasiyet:** sigara durum + günlük adet + yıl → paket-yıl otomatik; alkol durum + haftalık içki.
- **Durum zorunlu, miktar koşullu:** sigara/alkol durumu seçilmeli; miktar yalnız `former`/`current` (sigara) ve `regular` (alkol) seçilince zorunlu.

## Global Kısıtlar
- Kolonlar DB'de **nullable** (mevcut talepler bozulmaz); zorunluluk client'ta (yaş/kilo deseniyle aynı).
- `smoking_pack_years` **generated column** — hesap DB'de, drift yok, sorgulanabilir.
- CHECK kısıtları (aralık): adet 0-200, yıl 0-100, içki/hafta 0-200 (migration 0019 demografi CHECK deseni).
- AI'a yalnız onamlı taleplerde gider (mevcut onam kapısı). FR-21 korunur (doktordan önce değil — bu alanlar doktora da görünür, sorun yok).
- Mobil: doktor uygulaması bu alanları **okur/gösterir**; giriş yalnız web (satışçı/aracı).

## Veri Modeli (migration 0031)
```sql
create type smoking_status as enum ('never','former','current');
create type alcohol_status as enum ('never','occasional','regular');
alter table request
  add column smoking_status smoking_status,
  add column smoking_cigs_per_day int,
  add column smoking_years int,
  add column smoking_pack_years numeric generated always as (
    case when smoking_cigs_per_day is not null and smoking_years is not null
      then round((smoking_cigs_per_day::numeric / 20.0) * smoking_years, 1) else null end
  ) stored,
  add column alcohol_status alcohol_status,
  add column alcohol_drinks_per_week int,
  add constraint smoking_cigs_range check (smoking_cigs_per_day is null or (smoking_cigs_per_day between 0 and 200)),
  add constraint smoking_years_range check (smoking_years is null or (smoking_years between 0 and 100)),
  add constraint alcohol_drinks_range check (alcohol_drinks_per_week is null or (alcohol_drinks_per_week between 0 and 200));
```
`RequestRow` (src/types/db.ts) yeni kolonlarla güncellenir.

## Etiketler (Türkçe)
- Sigara: `never`=Hiç kullanmadı · `former`=Bıraktı · `current`=Aktif içici
- Alkol: `never`=Hiç · `occasional`=Sosyal (ara sıra) · `regular`=Düzenli

## Domain (src/domain/lifestyle.ts)
- `packYears(cigsPerDay, years): number | null` — null-güvenli, TS ikizi (generated column ile aynı formül).
- `smokingStatusLabel(s)`, `alcoholStatusLabel(s)`.
- `lifestyleComplete({smokingStatus, smokingCigs, smokingYears, alcoholStatus, alcoholDrinks}): boolean` — zorunlu koşullu alanlar dolu mu (wizard validasyonu + test).

## Wizard (NewRequestWizard.tsx)
Yeni Card **"Sigara & Alkol"** (Tıbbi Geçmiş'ten sonra):
- **Sigara** select (Hiç/Bıraktı/Aktif) → `former`/`current` seçilince koşullu: *Günlük adet* + *Kaç yıldır* input'ları; yanında canlı `≈ N paket-yıl` (packYears).
- **Alkol** select (Hiç/Sosyal/Düzenli) → `regular` seçilince koşullu: *Haftalık standart içki* input.
- Validasyon `canSubmit`'e: durum seçili + koşullu miktar dolu (`lifestyleComplete`). `missingFields`'a "Sigara/alkol bilgisi" eklenir.
- `requestDraft` tipi + saveDraft/loadDraft + clearDraftAndReset yeni alanları içerir.
- `useCreateRequest` NewRequestInput + request insert yeni kolonları yazar (miktar yalnız ilgili durumda, aksi null).

## AI Triyaj (ai-triage)
- `TriagePatient` (triage.ts): `smokingStatus`, `smokingPackYears`, `alcoholStatus`, `alcoholDrinksPerWeek`.
- `buildSummaryText`: "Sigara: {durum}, {paket-yıl} paket-yıl" + "Alkol: {durum}, {içki}/hafta" satırları.
- Sistem prompt: `demographics_operation_risk` açıklamasına "yoğun sigara (yüksek paket-yıl) / ağır alkol → yara iyileşmesi, anestezi ve kanama riski" eklenir.
- `index.ts`: `ctx.patient`'a yeni alanlar (request `select *` zaten getirir; `smoking_pack_years` generated okunur).

## Gösterim
- **Web** RequestDetail hasta kartı: "Sigara: Aktif içici · 10 paket-yıl" + "Alkol: Düzenli · 14/hafta" (durum `never` ise "Hiç").
- **Mobil** DoctorRequestView hasta kartı: aynı iki satır (salt okuma).

## Test
- Domain: `packYears` (null/normal), etiketler, `lifestyleComplete` (durum eksik/koşullu miktar eksik/tam).
- Migration: canlı doğrulama — insert + generated pack-years hesabı, CHECK reddi.
- Wizard: mevcut E2E core-flow'a sigara/alkol adımı eklenir (Hiç/Hiç ile hızlı geçiş; ayrı bir "aktif içici" varyantı opsiyonel).

## Kapsam Dışı
- Geçmiş taleplere geriye dönük veri doldurma (null kalır).
- Sigara/alkol için ayrı risk skoru/pano filtresi (paket-yıl sorgulanabilir; ileride eklenebilir).

## İlgili Kod
- Şema deseni: 0007_enrichment.sql, 0019 CHECK kısıtları · Wizard: NewRequestWizard.tsx (Tıbbi Geçmiş Card, canSubmit, missingFields, requestDraft) · health.ts (validasyon deseni) · useRequests.ts (insert) · AI: ai-triage/triage.ts + index.ts · Gösterim: RequestDetail.tsx, mobile/src/app/(tabs)/... DoctorRequestView
