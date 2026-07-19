# M3 Skor + SLA + Eskalasyon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** BRD §6.2 + FR-24/25/26/29/29b — otomatik puanlama, 24s SLA, hatırlatma push'u, koordinatör gecikme panosu, doktor hız görünümü (spec: `2026-07-19-medtriage-m3-skor-sla-design.md`).

**Architecture:** Motor tamamen DB'de (migration 0014: score_event + trigger'lar + run_sla_sweep + pg_cron 15dk); hatırlatma mevcut push hattıyla (`notify-sla` edge fn, app_secret deseni). UI: AllRequests filtre sekmeleri + DoctorAdmin skor bölümü + kuyruk SLA rozetleri (web+mobil).

## Global Constraints
- Her atamaya en fazla BİR score_event (unique assignment_id) — çifte ceza/ödül yasak.
- doctor.score 0–100 kelepçeli; mevcut trigger/status makinesi DEĞİŞMEZ.
- Hasta adı push metnine girmez. UI Türkçe, kod İngilizce; commit Türkçe conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Web 121 test + E2E + build ve mobil 20 test + tsc yeşil kalır.

## Task 1 (controller): Migration 0014 + pg_cron
Spec §2'deki şema/trigger/fonksiyon; `apply_migration` ile uygula; pg_cron job'ı doğrula (`cron.job` sorgusu). Commit `feat: skor motoru + SLA süpürücü (score_event, trigger'lar, pg_cron)`.

## Task 2 (controller): notify-sla Edge Function
Spec §3; deploy (verify_jwt=false); secret'siz 401 smoke. Commit `feat: notify-sla hatırlatma fonksiyonu`.

## Task 3 (subagent): Web koordinatör UI
- `AllRequests.tsx`: sekmeler Tümü/Bekleyen/Geciken/Tamamlanan; `slaInfo(assignedAt, slaHours, hasAccept, status)` domain yardımcı (`src/domain/sla.ts`, TDD) — kalan saat/aşım; Geciken satırda kırmızı "SLA aşıldı · Xs" rozeti. Tenant sla_hours useAuth/tenant sorgusuyla (tek satır select) alınır.
- `DoctorAdmin.tsx` + `useDoctors.ts`: skor rozeti (<10 kırmızı "Çalışılmaz"), zamanında/geç sayıları (score_event group by), ort. yanıt süresi (mevcut metrik), dönemsel: "Son 1 ay" + tarih aralığı inputları → net değişim + son 6 ay aylık net mini liste.
- Commit `feat: gecikme panosu + doktor skor görünümü`.

## Task 4 (subagent): Kuyruk SLA rozetleri (web + mobil)
- Web `DoctorQueue.tsx` + mobil `QueueRow.tsx`: `slaBadge` (web `src/domain/sla.ts`'ten; mobil `mobile/src/domain/sla.ts` KOPYA + jest) — nötr/amber(≤4s)/kırmızı(aşım). Yanıtlanmışlara rozet yok.
- Commit `feat: kuyrukta SLA geri sayım rozetleri (web+mobil)`.

## Task 5 (controller): Canlı doğrulama + review + merge
Spec §7 senaryosu (sla_hours=0 hilesiyle sweep, +1/−1/unique, Çalışılmaz rozeti, panel sekmeleri, cron kaydı; sonra 24'e dönüş) + tüm süitler + final review + merge.
