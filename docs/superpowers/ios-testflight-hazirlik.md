# iOS TestFlight / App Store Hazırlık Paketi — MedTriage Doktor

> Apple üyeliği **Active** olunca: (1) `npx eas-cli build --platform ios --profile production` → build,
> (2) App Store Connect'te uygulama kaydı (aşağıdaki metinlerle), (3) `eas submit` → TestFlight.
> Bu doküman App Store Connect formlarını doldururken referanstır.

## 0. Teknik kimlik (hazır)
- **Bundle ID:** `com.rememore.medtriage`
- **EAS proje:** `@capan2007/medtriage-doktor` (projectId `df6e80ad-ad3e-494b-8929-425cbe74e560`)
- **Sürüm:** 1.0.0 (buildNumber EAS remote ile otomatik artar)
- **Apple ID (üyelik):** capan3014@gmail.com
- **Export compliance:** `ITSAppUsesNonExemptEncryption=false` app.json'da → App Store Connect'te "şifreleme" sorusuna ek belge GEREKMEZ.

## 1. App Information (App Store Connect → App Information)
- **App Name (görünen ad):** `MedTriage Doktor`  *(30 karakter sınırı; alternatif: "MedTriage — Doktor")*
- **Subtitle (alt başlık, 30 kr):** `Estetik cerrahi talep yönetimi`
- **Primary Category:** Medical
- **Secondary Category:** Business (opsiyonel)
- **Content Rights:** Üçüncü taraf içerik yok
- **Age Rating:** 17+ (tıbbi/sağlık bilgisi içerir — anket sırasında "Medical/Treatment Information: Infrequent/Mild" işaretle)

## 2. Sürüm bilgileri (Version → 1.0)
- **Promotional Text (170 kr):**
  `Kliniğinizin estetik cerrahi taleplerini doktorlara yönlendirin, yapay zekâ destekli ön değerlendirmeyle hızlı karar verin.`
- **Description:**
```
MedTriage Doktor, estetik cerrahi kliniklerinin hasta taleplerini yöneten profesyonel bir triyaj uygulamasıdır. Yalnızca klinik personeli (doktor, koordinatör, satış) tarafından kullanılır; hasta kaydı klinik tarafından oluşturulur.

Özellikler:
• Size atanan hasta taleplerini anlık görün ve yönetin
• Hasta bilgilerini, fotoğrafları ve tıbbi geçmişi tek ekranda inceleyin
• Talebi kabul edin veya gerekçeyle reddedin, tedavi planı iletin
• Yapay zekâ destekli ön değerlendirme (yalnızca yol gösterici; nihai karar hekime aittir)
• 6 dil desteği (Türkçe, Arapça, İngilizce, Rusça, Almanca, Fransızca)
• Yeni talep bildirimleri

Not: Bu uygulama bir tıbbi tanı cihazı değildir. Yapay zekâ çıktıları yalnızca karar desteği amaçlıdır; tüm klinik kararlar yetkili hekim tarafından verilir.
```
- **Keywords (100 kr, virgülle):** `estetik,cerrahi,klinik,doktor,triyaj,hasta,medical,aesthetic,rememore`
- **Support URL:** `https://medtriage.rememore.workers.dev`  *(veya klinik destek e-postası sayfası)*
- **Marketing URL (ops.):** `https://medtriage.rememore.workers.dev`

## 3. App Privacy (veri toplama beyanı — "nutrition label")
Apple soracak. İşaretlenecekler (hepsi **App Functionality** amaçlı, **kimliğe bağlı (linked)**, **takip (tracking) DEĞİL**):

| Veri türü | Açıklama |
|---|---|
| **Contact Info** → Name, Phone Number | Hasta/kullanıcı ad-soyad, telefon |
| **Health & Fitness** → Health | Yaş/kilo/boy/cinsiyet, geçmiş ameliyat, hastalık, ilaç |
| **User Content** → Photos or Videos | Hasta fotoğraf/röntgen görüntüleri |
| **Identifiers** → User ID | Uygulama içi kullanıcı kimliği (giriş) |
| **Diagnostics** → Crash/Performance (varsa) | Yalnız Sentry eklenirse; şu an yoksa işaretleme |

- **Used for Tracking?** → **Hayır** (üçüncü taraf reklam/izleme yok)
- **Linked to identity?** → **Evet** (klinik hesabına bağlı)
- Push token: iletişim/bildirim amaçlı; ayrı "tracking" değil.

## 4. Privacy Policy (ZORUNLU URL)
Apple, hesaplı + sağlık verili uygulamada **gizlilik politikası URL'i** ister.
- **URL:** `https://medtriage.rememore.workers.dev/aydinlatma`
- Sayfa **altı dilde** (tr, ar, en, ru, de, fr) tam metin sunar; `?lang=<kod>` ile
  doğrudan istenen dilde açılır (ör. `/aydinlatma?lang=ar`). Arapça'da RTL.
- Metin yapısı ve sürümleme: `src/pages/legal/` (bkz.
  `docs/superpowers/specs/2026-07-28-kvkk-aydinlatma-cok-dilli-design.md`).
- ⚠️ **Submit ÖNCESİ kalan TEK koşul:** `src/pages/legal/clinicIdentity.ts` içindeki
  `CLINIC_IDENTITY` doldurulmalı (ticaret unvanı, açık adres, başvuru e-postası;
  opsiyonel telefon/VERBİS). Bu alanlar boş olduğu sürece sayfa otomatik olarak
  "TASLAK" bannerı gösterir ve Apple reviewer bunu görür.
- Nihai metin KVKK danışmanı onayından geçmelidir (özellikle `legalBasis` bölümü).

> ⚠️ **VERİTABANI UYARISI — deploy'dan ÖNCE uygulanmalı:**
> `supabase/migrations/0060_consent_text_version.sql` migration'ı bu yazının
> tarihinde **HENÜZ canlı (production) veritabanına uygulanmadı**. Bu migration
> `request` tablosuna `consent_text_version` ve `consent_lang` kolonlarını ekler.
>
> **Sıra kritik:** migration canlıya uygulanmadan frontend deploy edilirse, onam
> alınan HER talep oluşturma isteği başarısız olur. Sebep: `request` insert'i
> artık var olmayan bir kolonu (`consent_text_version`) adlandırır; PostgREST
> şemada olmayan bir kolona insert edildiğini görünce isteği reddeder. Bu insert
> tip güvenli (typed) değildir, dolayısıyla derleme zamanında (`npx tsc -b
> --noEmit`) YAKALANMAZ — hata yalnızca çalışma zamanında, canlıda ortaya çıkar.
>
> Bu migration'ın canlıya uygulanması **insan operatörün elle yapacağı bir
> iştir** (bu ajan/otomasyon Supabase MCP aracı veya `supabase db push`
> KULLANMADI ve kullanmamalıdır). Deploy sırası: **(1) migration'ı canlıya
> uygula → (2) doğrula → (3) ancak sonra frontend'i deploy et.**

## 5. App Review (inceleme) notları
- **Sign-in required** → **Demo hesabı ver:**
  - Kullanıcı: `plastik@rememore.test`
  - Şifre: `MedTriage2026!`
  - (Doktor rolü — kuyruk/talep/AI panelini görür)
- **Review Notes (İngilizce yaz):**
```
This is a B2B clinical tool used only by clinic staff (doctors, coordinators, sales agents). Patients do NOT self-register; patient records are created by clinic staff. Please use the provided demo account to sign in as a doctor.

The AI features provide advisory decision-support only and are clearly labeled as such in-app ("guidance only; the final decision belongs to the physician"). This app is not a medical diagnostic device.
```
- **Export compliance:** "Uses non-exempt encryption?" → **No** (app.json'da ayarlı).

## 6. TestFlight (iç test)
- Build TestFlight'a düşünce: App Store Connect → TestFlight → **Internal Testing** grubu oluştur → Rememore doktorlarının **Apple ID e-postalarını** ekle (max 100 iç test kullanıcısı, App Store incelemesi GEREKMEZ, anında).
- Doktorlar: App Store'dan **TestFlight** uygulamasını kurar → davet e-postasındaki linkten uygulamayı yükler.
- **Export compliance** TestFlight'ta da sorulur → No.

## 7. Görsel varlıklar (App Store için, TestFlight'ta gerekmez)
- App icon 1024×1024: `mobile/assets/images/icon.png` ✓ (EAS build otomatik alır)
- **Screenshots (App Store yayını için ZORUNLU, TestFlight için değil):** 6.7" (iPhone 15 Pro Max) + 6.5" ekran görüntüleri gerekir. Build simülatörde/cihazda çalışınca çekilir. (TestFlight aşamasında atlanabilir.)

---
### Sıra (üyelik Active olunca)
1. `cd ~/Projects/medtriage/mobile && npx eas-cli build --platform ios --profile production`
2. App Store Connect → yeni app (bu dokümandaki metinlerle) + App Privacy + demo hesap
3. `npx eas-cli submit --platform ios --profile production` → TestFlight
4. TestFlight → Internal Testing → doktorları ekle → davet
