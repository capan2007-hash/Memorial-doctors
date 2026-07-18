# P0 Veri Maskeleme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** LLM'e giden ve depolanan hasta verisindeki kaza kaynaklı PII sızıntılarını kapatmak (analiz raporu K1–K4).

**Architecture:** (1) Saf `scrubPii()` modülü serbest metinleri prompt'a girmeden maskeler; `fullName` bağlamdan tamamen çıkar; sistem prompt'una ad/PII yasağı eklenir. (2) Client foto hattı: dosya adı yalnız UUID+uzantı; görüntü canvas re-encode ile EXIF'ten arındırılır.

**Tech Stack:** Mevcut. Yeni bağımlılık YOK (canvas API yeterli).

## Global Constraints
- `triage.ts`/`scrub.ts` saf TS kalır (Deno importu yok; vitest ile test edilir).
- FR-11 korunur: maskeleme hatası talep akışını durduramaz.
- Commit Türkçe conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Task 1: scrubPii + fullName kaldırma + prompt talimatı (TDD)
**Files:** Create `supabase/functions/ai-triage/scrub.ts`, `src/domain/__tests__/scrub.test.ts`; Modify `supabase/functions/ai-triage/triage.ts` (+testleri), `supabase/functions/ai-triage/index.ts`
**Produces:** `scrubPii(text: string): string` — TC kimlik (11 ardışık hane), telefon (+90/0 ile 10-11 hane, ayraçlı biçimler dahil), e-posta, IBAN (TR + 24 hane) → `[maskelendi]`; diğer metin aynen korunur.
- triage.ts: `TriagePatient.fullName` alanı SİLİNİR; `buildSummaryText` serbest metin alanlarını (pastSurgeries, knownConditions, medications, notes) ve feedbackHints note/summary'yi `scrubPii()`'den geçirir; `buildSystemPrompt`'a satır: "Hastanın adını asla kullanma; çıktında hastayı tanımlayabilecek kişisel veri (ad, telefon, kimlik numarası) yazma."
- index.ts: ctx kurulumundan `fullName` kaldırılır (artık derlenmez zaten).
- [ ] RED→GREEN testler: TC/telefon/e-posta/IBAN maskelenir; sıradan sayılar (yaş 35, boy 175, yıl 2019) MASKELENMEZ; buildSummaryText maskelenmiş çıktı üretir; fullName tipten kalktı; system prompt yeni yasağı içerir.
- [ ] Commit `feat: scrubPii maskeleme + fullName kaldırma (gizlilik K3/K4)`.

## Task 2: Foto yükleme hattı — UUID dosya adı + EXIF strip
**Files:** Modify `src/features/requests/usePhotoUpload.ts`; Create `src/features/requests/sanitizeImage.ts` + `src/features/requests/__tests__/sanitizeImage.test.ts`
**Produces:** `safeExt(file: File): string` (mime→uzantı: jpeg|png|webp; bilinmeyen→'jpg'); `sanitizeImage(file: File): Promise<Blob>` — createImageBitmap + canvas.toBlob re-encode (EXIF/GPS metadata düşer; jpeg kalite 0.92, png/webp tip korunur; herhangi bir hatada ORİJİNAL dosya döner — akış durmaz).
- usePhotoUpload: `path = tenant/request/${crypto.randomUUID()}.${safeExt(file)}` (orijinal `file.name` HİÇBİR yerde kullanılmaz); upload öncesi `await sanitizeImage(file)`.
- [ ] Testler: safeExt eşlemeleri; sanitizeImage hata yolunda orijinali döndürür (canvas'ı jsdom'da mock'la); usePhotoUpload path'inde file.name geçmez (birim ya da statik assert).
- [ ] Commit `feat: foto yüklemede UUID dosya adı + EXIF temizleme (gizlilik K1/K2)`.

## Task 3: Deploy + canlı doğrulama + merge (controller)
- [ ] Edge function yeniden deploy (triage.ts değişti).
- [ ] Canlı: yeni fotoğraflı talep → storage path'te orijinal ad yok; indirilen dosyada EXIF yok (`exiftool`/`strings` kontrolü); AI değerlendirmesi üretiliyor; maskeli metin senaryosu (nota telefon yaz → prompt'ta maskelenir — unit test kanıtı yeterli).
- [ ] 91+ test + E2E + build yeşil; final review; merge.
