# Sigara & Alkol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Talep formuna sigara/alkol kullanımını miktarıyla (paket-yıl / haftalık içki) eklemek; AI ön-triyaja risk girdisi vermek; web+mobil doktora göstermek.

**Architecture:** request tablosuna nullable kolonlar + generated `smoking_pack_years`; wizard'da koşullu alanlar; domain `packYears`/`lifestyleComplete`; AI bağlamına satırlar; RequestDetail + mobil gösterim.

**Tech Stack:** Supabase Postgres (enum + generated + CHECK), React+TS wizard, Deno edge fn, vitest, mobil RN.

## Global Constraints
- Kolonlar nullable (mevcut talepler bozulmaz); zorunluluk client'ta.
- Enum: `smoking_status('never','former','current')`, `alcohol_status('never','occasional','regular')`.
- `smoking_pack_years` generated stored = round(cigs/20 × years, 1).
- Migration canlı uygulanır (Supabase MCP, ref `oxibdniwobetaksuxacs`), doğrulama sorgusuyla test. Dosya: `supabase/migrations/0031_lifestyle.sql`.
- Miktar yalnız ilgili durumda yazılır (aksi null).

---

### Task 1: Migration 0031 + RequestRow tipi

**Files:** Create `supabase/migrations/0031_lifestyle.sql`; Modify `src/types/db.ts`.

- [ ] **Step 1: Migration yaz**
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
- [ ] **Step 2: Uygula** — `apply_migration` name `0031_lifestyle`.
- [ ] **Step 3: Doğrula** — `execute_sql`: geçici insert (cigs=20, years=10) → `smoking_pack_years=10.0`; CHECK reddi (cigs=999 → hata). Temizle.
- [ ] **Step 4: RequestRow'a ekle** (src/types/db.ts): `smoking_status: 'never'|'former'|'current'|null; smoking_cigs_per_day: number|null; smoking_years: number|null; smoking_pack_years: number|null; alcohol_status: 'never'|'occasional'|'regular'|null; alcohol_drinks_per_week: number|null`.
- [ ] **Step 5: Commit** — `feat(lifestyle): sigara/alkol şema + generated pack-years`.

---

### Task 2: Domain lifestyle.ts + testler (TDD)

**Files:** Create `src/domain/lifestyle.ts`, `src/domain/__tests__/lifestyle.test.ts`.

- [ ] **Step 1: Başarısız test yaz**
```ts
import { describe, it, expect } from 'vitest'
import { packYears, smokingStatusLabel, alcoholStatusLabel, lifestyleComplete } from '../lifestyle'

describe('lifestyle', () => {
  it('paket-yıl hesabı', () => {
    expect(packYears(20, 10)).toBe(10)
    expect(packYears(10, 5)).toBe(2.5)
    expect(packYears(null, 5)).toBeNull()
    expect(packYears(20, null)).toBeNull()
  })
  it('etiketler', () => {
    expect(smokingStatusLabel('current')).toBe('Aktif içici')
    expect(alcoholStatusLabel('regular')).toBe('Düzenli')
    expect(smokingStatusLabel('never')).toBe('Hiç kullanmadı')
  })
  it('tamlık: durum eksik', () => {
    expect(lifestyleComplete({ smokingStatus: '', smokingCigs: '', smokingYears: '', alcoholStatus: 'never', alcoholDrinks: '' })).toBe(false)
  })
  it('tamlık: aktif içici miktar eksik', () => {
    expect(lifestyleComplete({ smokingStatus: 'current', smokingCigs: '', smokingYears: '10', alcoholStatus: 'never', alcoholDrinks: '' })).toBe(false)
  })
  it('tamlık: düzenli alkol içki eksik', () => {
    expect(lifestyleComplete({ smokingStatus: 'never', smokingCigs: '', smokingYears: '', alcoholStatus: 'regular', alcoholDrinks: '' })).toBe(false)
  })
  it('tamlık: tam', () => {
    expect(lifestyleComplete({ smokingStatus: 'current', smokingCigs: '20', smokingYears: '10', alcoholStatus: 'regular', alcoholDrinks: '14' })).toBe(true)
    expect(lifestyleComplete({ smokingStatus: 'never', smokingCigs: '', smokingYears: '', alcoholStatus: 'never', alcoholDrinks: '' })).toBe(true)
  })
})
```
- [ ] **Step 2: FAIL doğrula** — `npx vitest run src/domain/__tests__/lifestyle.test.ts`.
- [ ] **Step 3: lifestyle.ts yaz**
```ts
export type SmokingStatus = 'never' | 'former' | 'current'
export type AlcoholStatus = 'never' | 'occasional' | 'regular'

export function packYears(cigsPerDay: number | null, years: number | null): number | null {
  if (cigsPerDay == null || years == null || !(cigsPerDay >= 0) || !(years >= 0)) return null
  return Math.round((cigsPerDay / 20) * years * 10) / 10
}

const SMOKING: Record<SmokingStatus, string> = { never: 'Hiç kullanmadı', former: 'Bıraktı', current: 'Aktif içici' }
const ALCOHOL: Record<AlcoholStatus, string> = { never: 'Hiç', occasional: 'Sosyal', regular: 'Düzenli' }
export function smokingStatusLabel(s: SmokingStatus): string { return SMOKING[s] }
export function alcoholStatusLabel(s: AlcoholStatus): string { return ALCOHOL[s] }

export interface LifestyleInput {
  smokingStatus: string; smokingCigs: string; smokingYears: string
  alcoholStatus: string; alcoholDrinks: string
}
export function lifestyleComplete(i: LifestyleInput): boolean {
  if (!i.smokingStatus || !i.alcoholStatus) return false
  if (i.smokingStatus === 'former' || i.smokingStatus === 'current') {
    if (!(Number(i.smokingCigs) > 0) || !(Number(i.smokingYears) > 0)) return false
  }
  if (i.alcoholStatus === 'regular') {
    if (!(Number(i.alcoholDrinks) > 0)) return false
  }
  return true
}
```
- [ ] **Step 4: PASS doğrula** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(lifestyle): domain (packYears/etiket/tamlık) + testler`.

---

### Task 3: Wizard alanları + validasyon + insert

**Files:** Modify `NewRequestWizard.tsx`, `useRequests.ts`, `requestDraft.ts`, `missingFields.ts`.

- [ ] **Step 1:** `requestDraft.ts` `RequestDraft` tipine 5 alan ekle (smokingStatus/smokingCigs/smokingYears/alcoholStatus/alcoholDrinks — hepsi string), saveDraft/loadDraft koru (alanlar zaten serileşir).
- [ ] **Step 2:** `NewRequestWizard.tsx`: state (5 × useState string, draft'tan başlat), `clearDraftAndReset`'e ekle, draftRef'e ekle. "Tıbbi Geçmiş" Card'ından sonra **"Sigara & Alkol"** Card:
  - Sigara `<select>` (Hiç kullanmadı/Bıraktı/Aktif içici) → `former`/`current` iken iki `<input type=number>` (Günlük adet, Kaç yıldır) + canlı `≈ {packYears(Number(cigs),Number(years))} paket-yıl`.
  - Alkol `<select>` (Hiç/Sosyal/Düzenli) → `regular` iken `<input type=number>` (Haftalık standart içki).
  - `import { packYears, lifestyleComplete } from '../../domain/lifestyle'`.
  - `canSubmit`'e `&& lifestyleComplete({...})` ekle. `missing` listesine tamamlanmadıysa "Sigara/alkol bilgisi".
- [ ] **Step 3:** `useRequests.ts` `NewRequestInput`'a 5 alan (smokingStatus?: SmokingStatus|null, smokingCigsPerDay?: number|null, smokingYears?: number|null, alcoholStatus?: AlcoholStatus|null, alcoholDrinksPerWeek?: number|null). Request insert'e ekle: durum + miktar (miktar yalnız ilgili durumda, aksi null). Wizard submit call'una parse'lı değerleri geçir (never/occasional → miktar null).
- [ ] **Step 4:** `npx tsc --noEmit && npx vitest run` — yeşil.
- [ ] **Step 5: Commit** — `feat(lifestyle): wizard sigara/alkol alanları + validasyon + insert`.

---

### Task 4: AI triyaj bağlamı

**Files:** Modify `supabase/functions/ai-triage/triage.ts`, `supabase/functions/ai-triage/index.ts`.

- [ ] **Step 1:** `triage.ts` `TriagePatient`'a: `smokingStatus: string|null; smokingPackYears: number|null; alcoholStatus: string|null; alcoholDrinksPerWeek: number|null`. `buildSummaryText`'e iki satır (Sigara: durum + paket-yıl; Alkol: durum + içki/hafta). Sistem prompt `demographics_operation_risk` satırına sigara/alkol risk ibaresi.
- [ ] **Step 2:** `index.ts` `ctx.patient`'a yeni alanları map et (request'ten: smoking_status, smoking_pack_years, alcohol_status, alcohol_drinks_per_week).
- [ ] **Step 3: Deploy** — `deploy_edge_function` ai-triage (index.ts + triage.ts + scrub.ts — ÜÇÜ birden).
- [ ] **Step 4:** vitest (triage.ts saf modül testleri hâlâ yeşil) `npx vitest run`.
- [ ] **Step 5: Commit** — `feat(lifestyle): AI triyaj bağlamına sigara/alkol risk girdisi`.

---

### Task 5: Gösterim (web + mobil)

**Files:** Modify `src/features/requests/RequestDetail.tsx`; mobil DoctorRequestView (`mobile/src/app/(tabs)/...` veya request görünümü).

- [ ] **Step 1:** RequestDetail hasta kartına: "Sigara: {smokingStatusLabel} · {pack_years} paket-yıl" (never → sadece "Hiç kullanmadı"), "Alkol: {alcoholStatusLabel} · {drinks}/hafta". `smokingStatusLabel`/`alcoholStatusLabel` domain'den. Alanlar null ise "—" veya gizle.
- [ ] **Step 2:** Mobil doktor talep görünümü hasta kartına aynı iki satır (mobil domain kopyası/etiket).
- [ ] **Step 3:** `npx tsc --noEmit && npx vitest run`; mobil `cd mobile && npx tsc --noEmit && npx jest`.
- [ ] **Step 4: Commit** — `feat(lifestyle): sigara/alkol gösterimi (web RequestDetail + mobil)`.

---

### Task 6: Doğrulama + merge + deploy

- [ ] **Step 1:** Canlı görsel: satışçıyla wizard'da "Aktif içici 20/gün 10 yıl" + "Düzenli 14/hafta" gir → paket-yıl 10 görünür, talep oluşur; doktorda RequestDetail'de satırlar görünür (Playwright, iki tema screenshot; sonra sil + test verisi temizle).
- [ ] **Step 2:** Tam: `npx tsc --noEmit && npx vitest run && npm run build`; mobil tsc+jest.
- [ ] **Step 3:** finishing-a-development-branch: `feature/sigara-alkol` → main merge; `npm run deploy`; bellek güncelle.

## Self-Review
- Spec kapsaması: §Veri modeli→T1; §Domain→T2; §Wizard→T3; §AI→T4; §Gösterim→T5; §Test→T2/T6.
- Tip tutarlılığı: enum değerleri (never/former/current, never/occasional/regular) her yerde birebir; packYears formülü generated column ile aynı (cigs/20×years, 1 ondalık).
- Açık nokta: mobil doktor talep görünüm dosyasının tam yolu T5'te bulunacak (mobile/src altında RequestView).
