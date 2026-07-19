# P1 KVKK Onam Akışı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Onam yoksa AI (yurt dışı aktarım) çalışmaz; talep akışı devam eder. + patient RLS daraltma + font self-host (spec: `2026-07-19-medtriage-p1-kvkk-onam-design.md`).

## Global Constraints
- Onam yoksa Anthropic'e HİÇBİR veri gitmez (client invoke etmez + edge savunma). Onam talebi bloke etmez.
- Mevcut akış/RLS bozulmaz; M5 dedup (definer RPC) çalışmaya devam eder. Web 153 test + E2E + build yeşil. Commit Türkçe conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Task 1 (controller): Migration 0022 — consent + patient RLS
Spec "Veri modeli". apply_migration; canlı: agent başka satışçının hastasını okuyamaz, kendi hastasını okur; koordinatör hepsini. Commit `feat: onam kolonları + patient RLS daraltma`.

## Task 2 (controller): ai-triage onam kapısı
`ai-triage/index.ts`: request çekildikten sonra `consent_at` NULL ise `{ok:true, skipped:'no_consent'}` dön (Anthropic çağrısı YOK, failed yazma YOK). Redeploy; canlı: onamsız request id ile invoke → skipped, ai_evaluation satırı yok. Commit `feat: ai-triage onam kapısı (onamsız yurt dışı aktarım yok)`.

## Task 3 (subagent): Wizard onam bölümü + client gate + aydınlatma sayfası
- `useCreateRequest`: input `consentGiven?: boolean`; consentGiven ise request'e consent_at/consent_channel='whatsapp'/consented_by yaz; ai-triage invoke YALNIZ consentGiven true iken.
- `NewRequestWizard.tsx`: opsiyonel "Onam" Card (checkbox + /aydinlatma linki + "işaretlenmezse AI yapılmaz" notu); patient insert'e created_by ekle (useRequests.ts patient insert).
- `src/pages/Aydinlatma.tsx` (veya features/legal): public route `/aydinlatma` (App.tsx router — Protected DIŞI), statik Türkçe metin + belirgin "TODO: KVKK danışmanı onaylı nihai metin" uyarısı.
- Commit `feat: onam işaretleme + aydınlatma sayfası + AI onam gate (client)`.

## Task 4 (subagent): RequestDetail onam durumu + font self-host
- `RequestDetail.tsx` (sales/coord/admin RoleGate içinde): onam durumu satırı (verildi/verilmedi, tarih). useRequestDetail select'e consent_at/consent_channel ekle (gerekiyorsa).
- Font self-host: `npm i @fontsource/fraunces @fontsource/plus-jakarta-sans`; `index.css` Google @import kaldır; `main.tsx`'e fontsource importları (fraunces 500/600, plus-jakarta 400/500/600/700). Tailwind config font-family aynı.
- Commit `feat: onam durumu göstergesi + fontları self-host (Google CDN kaldırıldı)`.

## Task 5 (controller): Canlı doğrulama + review + merge
Spec "Test & doğrulama" senaryosu; tüm süitler + review + merge + deploy.
