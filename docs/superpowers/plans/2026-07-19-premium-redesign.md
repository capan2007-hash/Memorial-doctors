# Premium Redesign ("Rafine Klinik") Implementation Plan

> REQUIRED SUB-SKILL: subagent-driven-development. Steps use `- [ ]`.

**Goal:** Web ön yüzünü "Rafine Klinik" premium tasarım sistemine taşı — CSS-var token'lı açık+koyu tema, katmanlı yüzey, editoryal tipografi, sessiz motion, lucide ikon, çekirdek bileşen yükseltmeleri, ekran cilası (spec: `2026-07-19-premium-redesign-design.md`).

## Global Constraints
- Yalnız görsel katman; işlevsellik/RLS/veri akışı değişmez. Mobil hariç. Her faz: 153 test + E2E + build yeşil (E2E seçicileri zayıflatılmaz). Ham hex yerine token. Türkçe kopya. Commit Türkçe conventional + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Faz 1 — Foundation (token + tema + font + motion + ikon)
- [ ] `src/styles/tokens.css`: `:root` (açık) + `:root[data-theme="dark"]` (koyu) tüm CSS değişkenleri (yüzey/metin/kenarlık/brand rampa/semantik/gölge/radius/motion). index.css'e import.
- [ ] `tailwind.config.js`: darkMode: ['selector','[data-theme="dark"]']; renkleri var()'a eşle (surface-0..3, text-primary/secondary/muted, border/-strong, brand rampa, semantik). ESKİ brand/accent/surface/slate KORUNUR (geçiş için).
- [ ] Fontlar: mevcut Fraunces+Jakarta + yeni mono (@fontsource/geist-mono veya ibm-plex-mono) self-host; type-scale utility'leri.
- [ ] `npm i lucide-react`; `src/components/ui/Icon.tsx` ince sarmalayıcı (boyut/stroke tutarlı).
- [ ] `src/lib/theme.tsx`: ThemeProvider (localStorage + sistem tercihi; data-theme yazar) + `src/components/ui/ThemeToggle.tsx`.
- [ ] Doğrula: build+test yeşil, toggle çalışır (canlı). Commit `feat(ui): Rafine Klinik token katmanı + açık/koyu tema + lucide + mono font`.

## Faz 2 — Çekirdek bileşenler (subagent)
- [ ] Button, Card (elevation+hover), Field, StatusPill (state-dot+semantik, emoji yok), PageHeader (serif+hairline), Toast (aria-live+ikon+kritik kalıcı), EmptyState (ikon), Spinner + yeni **Skeleton**, Avatar, **Meter/Score**, **StatCard/Table** yardımcıları — hepsi yeni token+motion, iki tema. Mevcut prop API'leri korunur (ekranlar kırılmasın); StatusPill test'i güncellenebilir.
- [ ] Doğrula: 153 test yeşil (bileşen testleri prop-uyumlu), tsc, build. Commit `feat(ui): çekirdek bileşenler premium token+motion+ikon`.

## Faz 3 — Ekran cilası (subagent'ler, ekran grupları)
- [ ] Layout: header (marka işareti + ThemeToggle + ikon nav + aktif durum), doktor alt-nav farklı ikonlar, surface-0 zemin.
- [ ] Login: yeni yüzey/tipografi + marka.
- [ ] Talep detayı + wizard: kartlar/ritim, PatientInfoCard "enstrüman" dl, AiPanel/StatusPill/onam bantları ikon+semantik, emoji→ikon.
- [ ] Admin (AllRequests gecikme panosu + DoctorAdmin + PerformansPanosu): tablo hairline+tabular+hover, skor meter, filtre sekmeleri motion.
- [ ] Doktor kuyruğu + RequestList: satırlar, SLA rozetleri, ikon.
- [ ] Kip normalizasyonu ("seç…" → siz kipi). Her grup sonrası build+test yeşil. Commit'ler ekran-grubu bazında.

## Faz 4 — Koyu tema + a11y + final
- [ ] İki temada tüm ekran canlı tur + ekran görüntüleri; kontrast (WCAG AA), focus-visible, prefers-reduced-motion.
- [ ] a11y: Toast/AiPanel aria-live; PhotoGrid lightbox role=dialog+aria-modal+focus-trap+kapat butonu.
- [ ] Eski kullanılmayan token/sınıf temizliği (geçiş bitince). Final review + merge + deploy.
