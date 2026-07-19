# MedTriage Doktor — iOS Yayın Rehberi (TestFlight)

Hedef: Doktorların iPhone'una TestFlight ile uygulamayı ulaştırmak. Tam App Store incelemesi gerekmez.

## Hazır olanlar (yapıldı)
- Bundle kimliği: `com.rememore.medtriage` (app.json)
- EAS build profilleri: development / preview / production (eas.json)
- iOS ayarları: `ITSAppUsesNonExemptEncryption=false` (şifreleme muafiyeti), galeri izin metni
- expo-doctor 18/18 temiz

## Adım 1 — Apple Developer Program (SİZ, ~$99/yıl)
1. https://developer.apple.com/programs/enroll adresinden kaydolun (Apple ID gerekir).
2. Kimlik doğrulaması birkaç saat–birkaç gün sürebilir. Onaylanınca devam.

## Adım 2 — Expo girişi (SİZ, kendi terminalinizde)
```
cd ~/Projects/medtriage/mobile
npx eas-cli@latest login
```
E-posta + şifrenizle giriş yapın (onboarding'de açtığınız Expo hesabı).

## Adım 3 — Projeyi Expo hesabınıza bağla (SİZ ya da asistan)
```
cd ~/Projects/medtriage/mobile
npx eas-cli@latest init
```
`medtriage-doktor` projesini hesabınız altında oluşturur, `extra.eas.projectId`'yi app.json'a yazar.

## Adım 4 — iOS build (SİZ, kendi terminalinizde)
> Bu adım Apple hesabınıza giriş isteyecek (sertifika/provisioning otomatik üretilir). İnteraktif olduğu için sizin terminalinizde çalıştırın.
```
npx eas-cli@latest build --platform ios --profile preview
```
- "Set up push notifications?" → Yes (push için APNs anahtarı otomatik üretilir).
- Apple ID + 2FA istenir; EAS sertifikaları otomatik yönetir.
- Build bulutta ~15–25 dk sürer; biten build için indirme/QR linki verir.

## Adım 5 — TestFlight'a yükle
```
npx eas-cli@latest submit --platform ios --latest
```
- App Store Connect'e yükler. İlk seferde uygulama kaydı + gizlilik politikası URL'si istenir:
  - Gizlilik politikası URL: `https://medtriage.rememore.workers.dev/aydinlatma` (nihai KVKK metni konduktan sonra).
  - Veri toplama beyanı: "sağlık verisi + fotoğraf, hesapla korunan, yurt dışı AI'a aktarım (onamla)".
- App Store Connect → TestFlight → doktorları e-posta ile davet edin (harici test, ~1 gün Apple ön incelemesi).

## Push için not
Development/preview build push destekler (APNs anahtarı adım 4'te üretilir). Expo Go push desteklemez; bu build gerçek uygulamadır.

## Yayın sonrası güncelleme
- JS değişikliği → `npx eas-cli@latest update --branch preview` (mağaza beklemeden telefonlara iner).
- Native değişiklik (izin/kütüphane/ikon) → yeni build + submit.

## Kalan cila (yayın öncesi, opsiyonel)
- Gerçek uygulama ikonu (şu an şablon ikon; 1024x1024, şeffaflıksız).
- Aydınlatma metninin KVKK danışmanı onaylı nihai hali (`src/pages/Aydinlatma.tsx`).
- Anthropic Console: DPA onayı + Zero Data Retention talebi.
