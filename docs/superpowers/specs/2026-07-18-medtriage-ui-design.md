# MedTriage — UI Yenileme: "Klinik Güven" (Tasarım Spec'i)

**Tarih:** 2026-07-18
**Sürüm:** 1.0
**Önkoşul:** M1 + M1.5 main'de; sekme-dönüşü form silme bug'ı düzeltildi (940460e).
**Kapsam:** Görsel restyle + UX iyileştirme + talep formu taslak koruması. **İş mantığı, hook'lar, RLS, rotalar, doğrulama kuralları ve FR-21 sınırı DEĞİŞMEZ.**

---

## 1. Amaç

M1/M1.5 işlevsel ama arayüz ham: görsel kimlik yok, tek dar sütun, placeholder-only input'lar, ortalanmış bilgi kartları, UUID başlıklar, tek tip gri durum rozetleri, geri bildirim/boş durum tasarımı yok. BRD NFR'leri ("mobil-öncelikli", "WhatsApp'tan geçişi kolaylaştıran tanıdık arayüz") karşılanmıyor. Bu tur ürünü "Klinik Güven" görsel kimliğiyle yeniden giydirir ve UX'i düzeltir.

## 2. Tasarım Temeli (Design Tokens)

`tailwind.config.js` theme extension + `src/index.css` CSS değişkenleri (tek kaynaktan değişir):

| Token | Değer |
|-------|-------|
| Sayfa zemini | `#F8FAFC` · Kart: `#FFFFFF` |
| Ana (brand) | Teal `#0F766E` · koyu `#115E59` · açık zemin `#CCFBF1` / `#F0FDFA` |
| Vurgu/uyarı | Amber `#D97706` (eskalasyon, "Doktor atanmadı", bekleyen sayaç) · açık `#FEF3C7` |
| Hata/red | `#DC2626` · açık `#FEE2E2` |
| Durum renkleri | draft/submitted=gri · assigned=mavi (`#2563EB`/`#DBEAFE`) · in_review=indigo · offers_ready=teal · escalated=amber · closed=nötr koyu · red kararı=kırmızı — hepsi açık-zemin+koyu-metin rozet |
| Tipografi | Başlık: **Fraunces** (Google Fonts, `display=swap`) · Gövde/UI: **Plus Jakarta Sans** |
| Biçim | Kart `rounded-xl` + yumuşak gölge · input `rounded-lg`, odakta teal ring · buton `rounded-lg` |

## 3. Ortak Bileşen Katmanı (`src/components/ui/`)

| Bileşen | İçerik |
|---------|--------|
| `Button` | primary(teal)/secondary/danger/ghost + `loading` (spinner+disabled) |
| `Field` | **etiket + input/select/textarea + hata/yardım metni** — placeholder-only sorununu bitirir |
| `Card` | opsiyonel başlık + gövde; form bölümleri ve listeler için |
| `StatusPill` | yukarıdaki renk haritasıyla (mevcut bileşen taşınır/renklendirilir) |
| `EmptyState` | ikon + başlık + açıklama + opsiyonel aksiyon |
| `Skeleton`/`Spinner` | "Yükleniyor…" metinleri yerine |
| `Toast` | context tabanlı basit bildirim (başarı/hata); mutation sonuçları için |
| `PhotoGrid` | kare küçük önizlemeler + tıklayınca tam ekran lightbox (ESC/tıkla kapat) |
| `PageHeader` | başlık + alt metin + sağda aksiyonlar |
| `Avatar` | foto varsa foto, yoksa baş harfler (teal zemin) |

`Layout`: teal monogram logo ("M+" işareti, inline SVG), aktif nav vurgusu (alt çizgi/teal), mobilde doktor rolü için **alt sekme çubuğu**, diğer roller için açılır menü. Bekleyen sayaç amber rozet olarak nav'da (doktor).

## 4. Ekran Ekran Değişiklikler

- **Login:** split ekran (sol teal marka paneli — ad + kısa slogan; sağ form), `Field` ile etiketli alanlar, hata mesajı tasarımı, buton loading.
- **Talep formu (`NewRequestWizard`):** bölümlenmiş kartlar — "Hasta Bilgileri" (ad/soyad yan yana; yaş/cinsiyet/boy/kilo 2-4 kolon grid), "Tıbbi Geçmiş" (3 alan; "Yok" toggle'ları etiketle hizalı), "Operasyon" (kategori→alt kırılım→tip), "Fotoğraflar" (önizlemeli yükleyici; Diş'te ayrı röntgen kartı). Desktop `max-w-4xl`; Gönder + eksik-alan özeti altta sabit bant. Sıfır-doktor uyarısı amber banner.
- **Talep listeleri (satışçı + koordinatör):** satırlar **hasta adı + kategori/operasyon + göreli tarih ("2 sa önce") + renkli StatusPill**; UUID sadece detayda küçük gri. Koordinatörde "Doktor atanmadı" amber bant/rozet. EmptyState'ler. Tıklanabilir tüm satır.
- **Talep detayı & doktor görünümü:** başlık "**{Hasta Adı} — {Operasyon/Alt kırılım}**" + küçük talep no + StatusPill. `PatientInfoCard` **sol-hizalı 2 kolonlu tanım listesi**; BMI değeri rozet; boş değer soluk "Belirtilmedi". `PhotoGrid` (foto + Diş röntgeni ayrı bölüm). Doktor aksiyonları mobilde **sabit alt çubuk** (Kabul yeşil-teal / Red kırmızı); kabul/red panelleri `Field`'li düzgün form; yanıt sonrası toast.
- **Doktor kuyruğu:** WhatsApp-benzeri satırlar — kategori ikonu daire, hasta adı (görülmemişse **kalın**), operasyon + göreli süre, sağda StatusPill; unread nokta.
- **Doktor yönetimi:** sayfa **listeyle** açılır (avatar + unvan/branş + yetkinlik çipleri + skor); "Yeni Doktor" **dialog/panel** içinde bölümlenmiş form; kart genişleyince düzenleme + performans istatistik kutuları (Kabul/Red/Ort. dönüş/Skor). Kaydet/oluştur sonuçları toast.

## 5. Talep Formu Taslak Koruması (yeni özellik)

- **Sorun:** uygulama içinde başka sayfaya geçince form state'i kaybolur (SPA unmount). (Sekme-değişimi bug'ı ayrıca düzeltildi.)
- **Çözüm:** modül düzeyinde **in-memory taslak deposu** (`requestDraft` store): `NewRequestWizard` unmount olurken mevcut değerleri (metin alanları + seçimler + `File` referansları) saklar; mount olurken geri yükler. **Başarılı gönderimde temizlenir.** Formda "Taslağı temizle" ghost butonu + "taslak geri yüklendi" bilgi satırı.
- **Sınır:** tam sayfa yenilemede (hard reload) taslak kaybolur — kabul edilir (File objeleri serileştirilemez; sessionStorage metin-kısmı ileride değerlendirilebilir). BRD FR-5'in server-side taslağı ayrı/ileriki iştir.
- Kapsam: yalnız `NewRequestWizard` (en uzun/acılı form; YAGNI).

## 6. Değişmeyenler (garanti)

Domain katmanı, hook'ların veri akışı, RLS/politikalar, rotalar, form doğrulama kuralları (`canSubmit` mantığı), FR-21 (aracı plan göremez), create-doctor/scope akışları **aynen**. Bu tur ağırlıkla JSX/className + yeni sunum bileşenleri + taslak deposu. E2E'nin doğruladığı davranış korunur; selector değişirse test güncellenir (assertion zayıflatılmaz).

## 7. Doğrulama

- 29 birim testi + E2E yeşil kalır (taslak deposu için 1-2 yeni birim testi: sakla/geri yükle/temizle).
- Her ana ekran tarayıcıda **desktop + mobil (375px)** ekran görüntüsüyle kontrol; login→talep→doktor akışı canlı doğrulanır.
- Lighthouse/erişilebilirlik hedefi resmi değil; ama `Field` etiketleri + `alt` metinleri (followup'taki a11y eksiği) bu turda kapanır.

## 8. Açık Noktalar (bloke etmez)

- Logo/monogram basit inline SVG; gerçek marka çalışması ileride.
- Google Fonts ağ bağımlılığı: `display=swap` + sistem font fallback.
- Doktor alt sekme çubuğu M6 native tasarımına zemin hazırlar.
