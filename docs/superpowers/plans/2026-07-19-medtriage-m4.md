# M4 KVKK Fotoğraf Yaşam Döngüsü Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** BRD §7.8 FR-30b..FR-39 — sale_status işaretleme, sale_done→arşiv taşıma, 60g/30g otomatik imha, arşiv erişim kontrolü + denetim (spec: `2026-07-19-medtriage-m4-foto-yasam-dongusu-design.md`).

**Architecture:** Migration 0016 (sale_marked_at, photo.deleted_at/reason, tenant retention ayarları, arşiv RLS); edge fn `photo-lifecycle` (archive move + sweep) + `photo-url` (denetimli arşiv imzalı URL); pg_cron günlük sweep; UI satış durumu bölümü + imha placeholder.

## Global Constraints
- Silme geri alınamaz; her taşıma/silme/arşiv-erişim audit_log'a yazılır (FR-38/39). Silinen fotoğraf satırı KALIR (metadata).
- Arşiv fotoğrafı agent/sales'e kapalı (RLS + fonksiyon). Süreler tenant ayarı (kod sabiti yok).
- Web 135 test + E2E + build ve mobil test + tsc yeşil kalır. Commit Türkçe conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Task 1 (controller): Migration 0016
Spec "Veri modeli"; apply_migration; arşiv RLS'i doğrula (agent, layer='archive' foto satırını göremez — token testi Task 5'te). Commit `feat: foto yaşam döngüsü şeması (sale_marked_at, deleted_at, arşiv RLS, retention ayarları)`.

## Task 2 (controller): Edge fonksiyonları
`photo-lifecycle` (archive + sweep modları; sweep secret'li) + `photo-url` (arşiv imzalı URL + audit); `run_photo_lifecycle_sweep()` + pg_cron `0 3 * * *` (0016'ya dahil edilebilir veya ayrı 0017). Deploy; secret'siz sweep 401 + archive JWT yetki smoke. Commit `feat: photo-lifecycle + photo-url edge fonksiyonları + günlük cron`.

## Task 3 (subagent): Satış durumu UI + imha placeholder
- `useSetSaleStatus()` (src/features/requests/): sale_status+sale_marked_at update + audit + closed (sale_done) + fire-and-forget archive invoke.
- `RequestDetail.tsx`: RoleGate sales/coordinator/admin içinde "Satış Durumu" kartı (rozet + aksiyon butonları rol matrisine göre; operation_done yalnız koordinatör/admin); foto durum/kalan gün satırı (`photoLifecycle.ts` yardımcı, TDD).
- `PhotoGrid.tsx`/ilgili: deleted_at dolu foto → "KVKK gereği imha edildi ({tarih})" placeholder.
- Commit `feat: satış durumu işaretleme + foto imha göstergesi`.

## Task 4 (subagent): Doktor arşiv erişimi (web + mobil)
- Arşiv (`layer='archive'`) fotoğrafları `photo-url` fn ile yükle; aktifler doğrudan. Web `useRequestDetail`/PhotoGrid + mobil `useRequestDetail`/PhotoStrip.
- Commit `feat: doktor arşiv fotoğraflarını denetimli URL ile görür (web+mobil)`.

## Task 5 (controller): Canlı doğrulama + review + merge
Spec "Test & doğrulama" senaryosu (retention=0/buffer=0 hileleriyle sweep, arşiv taşıma, agent 0-satır, audit kayıtları, UI) + tüm süitler + final review + merge + deploy. Ayarları 60/30'a geri al.
