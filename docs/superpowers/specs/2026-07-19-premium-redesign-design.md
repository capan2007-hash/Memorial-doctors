# MedTriage Premium Ön Yüz — "Rafine Klinik" Tasarım Sistemi

Tarih: 2026-07-19 · Yön onaylı (Rafine Klinik · tasarım sistemi + tüm web · açık+koyu tema). frontend-design disipliniyle.

## Konu & duruş
MedTriage bir vitrin değil, güven-kritik klinik operasyon aracı (satışçı/koordinatör/doktor; yoğun veri: durum, skor, SLA, foto, AI). Estetik risk ölçülü olmalı: **cömert beyaz alan + katmanlı yüzey + editoryal tipografi + sessiz motion**. Cesaret tek yerde: **"klinik enstrüman" imza dili**.

## İmza öğesi
Durum/skor/SLA sisteminin tutarlı, hassas görsel dili:
- **Durum çipleri** öncü "state-dot" ile (emoji YOK): ● Teklif hazır, ● Eskalasyon, ● Bekliyor.
- **Tabular rakamlar** (skor, SLA geri sayım, süre, ID) mono/tnum ile hizalı — "cihaz" dokusu.
- **Bölüm başlıkları** Fraunces + altında saç-teli (hairline) çizgi.
- **Skor** ince arc/meter + renk kademesi (<10 kırmızı "Çalışılmaz").

## Token sistemi (CSS değişkenleri; açık+koyu)
`:root` altında ışık, `:root[data-theme="dark"]` altında koyu. Tailwind bu değişkenleri okur — tek kaynak, iki tema.

**Yüzey (elevation ölçeği):**
- açık: `--surface-0` #F5F7F5 (ılık, hafif yeşil-gri sayfa) · `--surface-1` #FFFFFF (panel) · `--surface-2` #FFFFFF+kenarlık (kart) · `--surface-3` #FFFFFF (popover, yükseltilmiş gölge)
- koyu: `--surface-0` #0E1513 · `--surface-1` #14201D · `--surface-2` #1A2825 · `--surface-3` #21322E

**Metin:** açık primary #14201D / secondary #566661 / muted #8A9691 · koyu primary #EAF0ED / secondary #9DB0AA / muted #6E827C
**Kenarlık:** açık `--border` #E4E8E5 / `--border-strong` #CDD5D1 · koyu #26352F / #33453E
**Brand (teal) rampa 50–900** ~#0F766E; koyu temada vurgu için 400/300 kullanılır.
**Semantik roller (bg-tint + border + text üçlüsü):** success (teal-yeşil), warning (amber #B45309), danger (rose #B4243A), info (slate-mavi). Amber eskalasyon/uyarıya rezerve.
**Gölge:** `--shadow-card` (iki katmanlı, yumuşak), `--shadow-pop` (popover). Koyu temada gölge derinleşir.
**Radius:** kart 12px, kontrol 8px, pill tam. **Kenarlık 0.5px hairline.**

## Tipografi
- **Display:** Fraunces (korunur) — optik boyutlandırma, iri boyutlarda sıkı tracking. Ölçek: title 30/36, heading 20/24, subhead 16.
- **Gövde:** Plus Jakarta Sans (korunur) — 15/1.6.
- **Data/mono:** yeni — tabular rakam + ID/timestamp için ince mono (Geist Mono ya da IBM Plex Mono, self-host). "Enstrüman" dokusu.
- Tümü self-host (@fontsource) — Google CDN yok (O2 zaten kapalı).

## Motion
Token'lar: `--dur-fast` 150ms, ease-out giriş. Kart hover translateY(-1px)+gölge; buton press scale(0.98); StatusPill/rozet yumuşak; sekme/filtre kayar. `prefers-reduced-motion` saygılı. Skeleton shimmer (spinner yerine ana ekranlarda).

## İkonografi & marka
- **lucide-react** ince ikon seti — emoji (⚠) tamamen kalkar; durum/uyarı/navigasyon/aksiyon ikonları.
- Marka monogramı ("+") → rafine MedTriage işareti (sade, ölçeklenebilir SVG: kesişen çapraz + nokta ~ "triyaj işareti").
- Header'a **tema anahtarı** (açık/koyu, güneş/ay ikonu).

## Bileşen yükseltmeleri (hepsi token'lı, iki tema)
Button (variant/size/loading, press motion), Card (elevation prop + hover), Field (premium focus ring), StatusPill (state-dot + semantik), PageHeader (serif + hairline), Toast (aria-live + ikon + kalıcı kritik), EmptyState (ikon + aksiyon), **Skeleton** (yeni), PhotoGrid (lazy + dialog semantiği), Avatar, **Meter/Score** (yeni), Table (hairline + tabular + hover satır), **ThemeToggle** (yeni), **Icon** sarmalayıcı.

## Uygulama stratejisi (kırılmadan)
1. **Foundation:** CSS-var token katmanı + Tailwind eşleme + tema toggle + fontlar + motion + lucide. Eski `brand/accent/surface/slate` sınıfları ÇALIŞMAYA DEVAM eder (yan yana), böylece hiçbir ekran anında kırılmaz.
2. **Çekirdek bileşenler:** ui/ bileşenleri yeni token+motion+ikon'a taşınır — her ekran aynı anda yükselir.
3. **Ekran cilası:** Layout(header+marka+toggle+ikon nav), login, talep detayı, wizard, admin pano, doktor kuyruğu — yüzey/ritim/tipografi + emoji→ikon.
4. **Koyu tema + a11y turu:** iki temada tüm ekranlar; aria-live (Toast/AiPanel), lightbox dialog+focus-trap; kontrast doğrulama.

## Kapsam & kısıtlar
Yalnız görsel katman — işlevsellik/RLS/veri akışı DEĞİŞMEZ. Mobil (Expo) bu turda HARİÇ (sonra). Her faz sonunda 153 test + E2E + build yeşil; E2E seçicileri (etiket/rol tabanlı) korunur — gerekirse güncellenir, zayıflatılmaz. Türkçe kopya; kip normalizasyonu ("seç…" → siz kipi) bu tura iliştirilir.

## Doğrulama
Her faz canlı tarayıcı turu (açık+koyu), ekran görüntüleri; a11y (focus, kontrast, reduced-motion); tam süit yeşil.
