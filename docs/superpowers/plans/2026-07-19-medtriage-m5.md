# M5 Mükerrer Kayıt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** BRD §7.9 FR-40..FR-45 — telefon + isim fuzzy mükerrer tespiti, geçmiş özeti, aynı/farklı hasta kararı, silinmiş-foto bayrağı, açık-talep haberdarlığı (spec: `2026-07-19-medtriage-m5-mukerrer-design.md`).

**Architecture:** Migration 0020 (request.photos_required, pg_trgm, find_patient_matches RPC); wizard telefon alanı + debounced eşleşme paneli; useCreateRequest existingPatientId/photosRequired; RequestDetail açık-talep bandı.

## Global Constraints
- Eşleştirme akışı BLOKE ETMEZ (FR-43). Otomatik birleştirme YOK. RPC tenant-scoped (definer içi filtre).
- Web 143 test + E2E + build yeşil. Commit Türkçe conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Task 1 (controller): Migration 0020 + RPC
Spec "Veri modeli"; apply_migration; canlı: iki benzer hasta ekleyip RPC'yi çağır, phone/name eşleşmesi + aggregate doğru. Commit `feat: mükerrer tespiti şeması (photos_required, pg_trgm, find_patient_matches RPC)`.

## Task 2 (subagent): Wizard telefon + eşleşme paneli + create değişikliği
- `src/domain/phone.ts` `normalizePhone(raw): string` (rakamlar, +90/0 → son 10 hane) + TDD.
- `NewRequestWizard.tsx`: "Telefon" alanı (zorunlu; missingFields'a 'Telefon' ekle); debounced RPC (`supabase.rpc('find_patient_matches', {...})`); `DuplicateMatchPanel` alt bileşeni (bloke etmeyen, aday listesi + "Aynı hasta"/"Farklı kişi"); seçilen patientId state; photos_required (had_deleted && !available) amber uyarı; has_open_request info.
- `useRequests.ts` `useCreateRequest`: `existingPatientId?`, `photosRequired?` — existingPatientId varsa patient insert atla; yeni hastada phone kaydet; request.photos_required yaz.
- Commit `feat: talep girişinde mükerrer hasta eşleştirme + telefon alanı`.

## Task 3 (subagent): RequestDetail açık-talep bandı
- `useSiblingOpenRequests(patientId, currentRequestId)` (status<>'closed', ≠ current); RequestDetail üstünde info bandı (varsa). photos_required olan talepte küçük "Fotoğraf yeniden gerekli" rozeti (kayıt görünürlüğü).
- Commit `feat: hastanın açık talep haberdarlığı`.

## Task 4 (controller): E2E güncelleme + canlı doğrulama + review + merge
E2E'ye telefon alanı ekle (mevcut akış bozulmasın); spec canlı senaryosu; tüm süitler + review + merge + deploy.
