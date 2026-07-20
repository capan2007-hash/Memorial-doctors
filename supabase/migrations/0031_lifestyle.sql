-- Sigara & alkol kullanımı (spec 2026-07-20): cerrahi/anestezi risk girdisi.
-- Miktar klinik ölçütlerle: sigara paket-yıl (generated), alkol haftalık içki.
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
