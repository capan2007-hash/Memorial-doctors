# MedTriage M6a — Doktor Mobil Uygulaması (RN/Expo) Tasarımı

Tarih: 2026-07-18 · Onay: kullanıcı ("ok"). Kapsam kararları: yalnız doktor rolü; push dahil; dağıtım önce Expo Go/EAS dev build; platform karışık (iOS+Android).

## 1. Mimari
- Aynı repo, `mobile/` klasörü: bağımsız Expo (RN + TypeScript) uygulaması; kendi package.json'ı (workspace YOK).
- Backend değişmez: aynı Supabase projesi (`oxibdniwobetaksuxacs`), aynı auth (e-posta+şifre), aynı RLS. Tüm güvenlik sınırları sunucuda; app yalnız istemci.
- Web'deki küçük saf yardımcılar (`timeAgo`, durum etiketleri, BMI/medicalValue) `mobile/src/domain`'e KOPYALANIR — Metro'nun repo-kökü dışı import kısıtı nedeniyle kabul edilmiş tekrar. Kopya dosyaların başına kaynak yolu yazılır.
- Navigasyon: Expo Router. Veri: @tanstack/react-query + @supabase/supabase-js (auth storage: AsyncStorage). Tema: Klinik Güven tokenları (brand teal #0F766E, accent amber #D97706, surface #F8FAFC); fontlar @expo-google-fonts (Fraunces + Plus Jakarta Sans).

## 2. Ekranlar
- **Giriş**: e-posta+şifre; oturum kalıcı (AsyncStorage). Doktor-dışı rol girerse: "Bu uygulama doktorlar içindir" + çıkış.
- **Bekleyen Talepler** (ana sekme): yanıtlanmamış atamalar listesi (webdeki DoctorQueue verisi); satır: hasta adı, operasyon, timeAgo; realtime INSERT aboneliği ile anında güncellenir.
- **Talep Detayı**: PageHeader (hasta — operasyon, StatusPill); Hasta Bilgileri kartı (yaş/cinsiyet/boy/kilo/BMI + tıbbi 3 alan + not); foto galerisi (yatay şerit → tam ekran zoom modal); **AI Triyaj Paneli** (web AiPanel eşleniği: failed/ok/warning durumları, Türkçe uyarı etiketleri + güven rozeti, "Uygunluk değerlendirmesi", disclaimer bandı "Yön göstericidir; nihai karar hekimindir.", Doğru/Kısmen doğru/Yanlış geri bildirim — verilmişse rozet); alt sabit bar: **Kabul** (tedavi planı çok satırlı input + onay) / **Red** (gerekçe input + onay). Yanıt verilmişse karar + plan salt-okunur görünür.
- **Geçmiş** (ikinci sekme): yanıtladığı talepler (karar rozeti ile).
- **Ayarlar** (üçüncü sekme): giriş yapan doktor adı, bildirim izni durumu + izin isteme düğmesi, çıkış.

## 3. Push bildirimi
- Yeni migration `push_token`: { id, tenant_id, doctor_id → doctor, expo_token text, platform text, updated_at; unique(doctor_id, expo_token) }. RLS: doktor kendi satırını insert/update/delete/select; koordinatör/admin select. Yazma yalnız kendi doctor_id'siyle.
- App: girişte + izin verildiğinde `expo-notifications` token alır, upsert eder; çıkışta kendi tokenını siler.
- Tetikleme: `assignment` tablosuna **Database Webhook** (Supabase, INSERT) → yeni Edge Function **`notify-assignment`** (service role): assignment→doctor→push_token(lar) + request→patient/kategori adı → Expo Push API'ye POST (`https://exp.host/--/api/v2/push/send`), body: title "Yeni talep", message "{Ad Soyad} — {operasyon}", data { requestId }. Hata yutulur (bildirim akışı talep akışını bozamaz). Webhook secret'ı: fonksiyon `verify_jwt=false` + `x-webhook-secret` başlığı kontrolü (secret Supabase secret'ı olarak saklanır).
- Bildirime dokunma → app `requestId` ile Talep Detayı'na yönlenir (expo-router deep link).
- Kısıt: Expo Go uzak push desteklemez → push testi EAS **development build** (önce Android APK; iOS dev build Apple Developer hesabı gerektirir, sonraya).

## 4. Kapsam dışı (YAGNI)
Satış/koordinatör ekranları, talep oluşturma, offline, mağaza yayını, biometrik kilit, çoklu dil.

## 5. Test & doğrulama
- `mobile/src/domain` kopyaları için birim testler (jest-expo).
- Canlı doğrulama: iOS simülatöründe Expo ile akış turu (giriş → kuyruk → detay → AI paneli → kabul/red), `xcrun simctl` ekran görüntüleri; push: Android dev build + gerçek/emülatör cihaz.
- Web tarafı ve mevcut E2E etkilenmez; web `npm run build` yeşil kalır.
