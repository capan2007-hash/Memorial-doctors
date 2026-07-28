# Telefon Numarasında Ülke Kodunun Korunması (E.164) — Tasarım

**Tarih:** 2026-07-28 · **Durum:** Onaylandı (kullanıcı) · **Kapsam:** Yalnız Web

## 1. Amaç

Yeni talep sihirbazı, hastayı yazarken telefonu `normalizePhone()` ile normalize
edip öyle kaydediyor (`src/features/requests/NewRequestWizard.tsx:275`).
`normalizePhone` rakam olmayan her şeyi atıp **son 10 haneyi** döndürüyor
(`src/domain/phone.ts:8`), dolayısıyla ülke kodu geri getirilemez biçimde yok
oluyor: `+966 51 234 5678` → `512345678`.

Bu iki soruna yol açıyor:

1. **Numara aranamaz hâle geliyor.** Hasta kitlesi ağırlıkla yurt dışı — uygulama
   altı dilli (tr, en, ar, ru, de, fr). Ülke kodu olmadan kaydedilen numara ne
   telefonla ne WhatsApp derin bağlantısıyla kullanılabilir.
2. **Mükerrer tespitinde ülkeler arası çakışma.** Son 10 hanesi aynı olan iki
   farklı ülkeden hasta, aday listesinde birbirinden ayırt edilemiyor —
   `DuplicateMatchPanel` telefonu gösteriyor ama gösterilen değer zaten
   soyulmuş (`src/features/requests/DuplicateMatchPanel.tsx:61`).

Veritabanı tasarımı zaten **ham numaranın saklanmasını, normalizasyonun yalnız
eşleştirme anında yapılmasını** varsayıyor: `patient_phone_norm_idx`, `phone`
sütunu üzerinde `normalize_phone(phone)` fonksiyonel indeksi
(`supabase/migrations/0020_duplicate_detection.sql:16`). İstemci tarafında
yazmadan önce normalize etmek bu tasarımı boşa çıkarıyor.

**Hedef olmayan:** mobil uygulama. Talep oluşturma akışı yalnız web'de var.
**Hedef olmayan:** ülkeler arası çakışmanın veritabanı seviyesinde çözülmesi
(§5'te gerekçesiyle birlikte ele alındı).

## 2. Onaylanan Kilit Kararlar

| Karar | Seçim |
|---|---|
| `patient.phone`'a ne yazılır | **Kanonik E.164** (`+905321112233`) — ham metin değil, ayrı sütun değil |
| Ülke kodu yoksa | **Varsayılan +90 (Türkiye)** uygulanır |
| Sihirbaz arayüzü | **Tek alan + canlı kanonik yansıma** — ülke kodu select'i değil, maske değil |
| DB `normalize_phone` | **Değişmez**, indeks yeniden kurulmaz |
| Mevcut satırlar | **Backfill yok**, oldukları gibi bırakılır ve belgelenir |
| `normalizePhone` | **Korunur** — eşleştirme/karşılaştırma için hâlâ kullanılıyor, yalnız yazma yolundan çıkarılır |

## 3. Domain Katmanı — `src/domain/phone.ts`

`normalizePhone` imzası ve davranışı **hiç değişmez**. Yanına üç saf fonksiyon
eklenir:

```ts
const DEFAULT_COUNTRY = { dialCode: '90', nationalLength: 10 }  // Türkiye

toE164(raw: string): string                  // yazma yolunun ürettiği değer
hasExplicitCountryCode(raw: string): boolean // UI ipucu için
isValidPhone(raw: string): boolean           // phoneOk için
```

### 3.1 `toE164` kuralları

Sıra önemlidir; aşağıdaki tabloda yukarıdan aşağıya ilk eşleşen kural uygulanır.

| # | Girdi örneği | Kural | Çıktı |
|---|---|---|---|
| 1 | `abc`, `''` | Rakam yok | `''` |
| 2 | `+966 51 234 5678` | `+` var → rakamlara olduğu gibi güvenilir | `+966512345678` |
| 3 | `00966512345678` | `00` uluslararası çıkış öneki → `+` karşılığı | `+966512345678` |
| 4 | `0532 111 22 33` | Baştaki trunk `0` atılır, varsayılan kod eklenir | `+905321112233` |
| 5 | `905321112233` | Varsayılan kodla başlıyor **ve** ulusal uzunluktan uzun → zaten uluslararası | `+905321112233` |
| 6 | `532 111 22 33` | Ulusal biçim | `+905321112233` |

İki sıralama kısıtı tasarımın parçasıdır:

- **3 numaralı kural 4'ten önce gelmelidir.** `00966…` girdisi baştaki `0`
  yüzünden trunk kuralına düşerse `+900966…` üretilir.
- **5 numaralı kural gereklidir.** Mevcut testlerde `905321112233` girdisi var;
  salt "ulusal biçim" kabul edilirse `+90905321112233` üretilirdi. Türkiye'de
  `90` ile başlayan alan kodu veya mobil öneki bulunmadığı için bu kuralın
  yanlış tetiklenmesi mümkün değil.

**Bilinen sınır:** ülke kodu yazılmamış yabancı numara (ör. `966512345678`)
5. kurala uymadığı için `+90966512345678` olur. Bu, tasarımın engellemeye değil
**görünür kılmaya** karar verdiği durumdur — §4'teki canlı yansıma satışçıya
`+90…` yazdığını gösterir ve düzeltme şansı verir.

### 3.2 `hasExplicitCountryCode`

"Girdi ülke kodunu kendisi belirliyor mu?" sorusunu yanıtlar; yani §3.1'deki
**2, 3 ve 5** numaralı kurallardan biri eşleşiyorsa `true`. 5. kuralın dahil
olması şart: `905321112233` girdisi doğru sonuca (`+905321112233`) ulaşır, bu
yüzden arayüzde "ülke kodu varsayıldı" uyarısı gösterilmemeli ve `isValidPhone`
onu ulusal-uzunluk dalına düşürmemeli.

### 3.3 `isValidPhone`

Tek bir "en az 10 hane" kuralı kullanılamaz: `toE164` başa iki hane eklediği için
bugün elenen `12345678` gibi girdiler geçerli sayılırdı. Kural ikiye ayrılır:

- Ülke kodu açıkça verilmişse → toplam 8–15 hane (E.164 sınırları).
- Varsayılan ülke devreye girmişse → ulusal kısım tam 10 hane (mevcut sıkılık
  aynen korunur).

## 4. Yazma Yolu ve Arayüz

### 4.1 Değişen satırlar

| Yer | Şu an | Olacak |
|---|---|---|
| `NewRequestWizard.tsx:275` | `phone: normalizePhone(phone)` | `phone: toE164(phone)` |
| `NewRequestWizard.tsx:197` | `normalizePhone(phone).length >= 10` | `isValidPhone(phone)` |
| `useRequests.ts:56` | — | Değişmez; değeri olduğu gibi yazıyor |

### 4.2 RPC çağrısı neden ham kalıyor

`find_patient_matches` çağrısına (`NewRequestWizard.tsx:163`) **ham `phone`
gitmeye devam eder.** Gerekçe: DB son 10 haneyi alıyor, `toE164` yalnızca başa
ekleme yapıyor, dolayısıyla 10 haneden uzun her girdide iki değerin son 10 hanesi
birebir aynı. E.164'e çevirmek fayda sağlamaz, buna karşılık yazma sırasındaki
yarım girdilerde (`053` → `+9053`) sonucu bozar. Bu gerekçe koda yorum olarak
yazılır.

### 4.3 Canlı kanonik yansıma

`Field` bileşeni `hint` desteğine zaten sahip (`src/components/ui/Field.tsx`);
yeni bileşen gerekmez. Telefon alanının altında:

| Durum | Gösterilen |
|---|---|
| Alan boş | İpucu yok |
| Ülke kodu açık | `Kaydedilecek: +966512345678` |
| Varsayılan uygulandı | `Kaydedilecek: +905321112233 · Ülke kodu girilmedi, +90 (Türkiye) varsayıldı` |

Ülke kodu select'i ve giriş maskesi değerlendirilip elendi:

- **Select + ulusal numara alanı**, "yapıştır ve doldur" akışını bozar. AI
  telefonu tek serbest metin olarak yazıyor (`NewRequestWizard.tsx:231`) ve
  taslak kaydet/geri yükle tek bir `phone` string'i taşıyor; alanı bölmek her iki
  yolda da rastgele metni (ülke kodu, ulusal numara) diye ayrıştırmayı gerektirir.
  Ayrıca elle seçilmiş ülke listesi daima birilerini dışarıda bırakır.
- **Giriş maskesi**, tek bir ülkenin numara biçimini kodlar — kaldırmaya
  çalıştığımız varsayımın ta kendisi. RTL dillerde de kötü davranır.

### 4.4 i18n

Altı dilin tamamında (tr, en, ar, ru, de, fr):

- `newRequest.phonePlaceholder`: `05XX XXX XX XX` → `+90 5XX XXX XX XX`
- Yeni: `newRequest.phoneHint.saved`, `newRequest.phoneHint.assumedCountry`

`src/i18n/__tests__/keyParity.test.ts` anahtar eşliğini zaten zorunlu kılıyor;
bir dil atlanırsa test kırmızıya döner.

## 5. Veritabanı ve Mevcut Kayıtlar

**Migration yok, backfill yok.**

DB'deki `normalize_phone` de son 10 hane mantığında
(`supabase/migrations/0020_duplicate_detection.sql:9`). Bu, eski ve yeni verinin
birbirini bulmasını sağlayan **tek köprü**: eski satır `5321112233` ile yeni satır
`+905321112233` aynı normalize sonucunu verir, eşleşmeye devam ederler. Ülke kodu
duyarlı bir normalize'a geçilirse eski satırlarda ülke kodu bulunmadığı için
eski↔yeni eşleşmesi tamamen kırılır; ayrıca fonksiyonel indeks kullanan
`immutable` bir fonksiyonu değiştirmek indeksi düşürüp yeniden kurmayı gerektirir.

Mevcut satırlarda ülke kodu **geri getirilemez**. Hepsinin Türk olduğu
ispatlanamayacağı için `+90` varsayan bir backfill de yapılmaz: yanlış ülke kodu
yazmak veriyi bugünkünden kötüleştirir — durum "bilinmiyor"dan "yanlış ama kesin
görünüyor"a döner.

Ülkeler arası çakışma böylece tamamen çözülmez, ancak **insan inceleme katmanında
fiilen çözülür**: `find_patient_matches` aday döndürüyor ve panel telefonu
gösteriyor. Bugün iki aday ekranda `5321112233` ve `5321112233` olarak ayırt
edilemiyor; tam E.164 saklandığında satışçı `+905321112233` ile `+9665321112233`'ü
ayırt edip yanlış adayı reddedebilir.

Bu çözüm yalnız **yeni hasta** yolunda tam işler. `useRequests.ts`daki
`useCreateRequest`, `existingPatientId` seçiliyken hasta insert'ini tamamen
atlıyor ve `patient.phone`'u hiç güncellemiyor — yani satışçı, panelde mevcut
bir adayı seçip tam numarayı yazsa bile, o hastanın DB'deki eski (ülke kodu
soyulmuş) `phone` değeri yükseltilmiyor. Dolayısıyla ayırt etme yeteneği yalnız
**yeni kayıtlar arasında** ve **yeni kayıt ile hâlâ eski biçimde duran bir
kayıt karşılaştırıldığında görünürde** işliyor; var olan bir hastanın kaydı bu
akışla asla E.164'e yükseltilmiyor, dolayısıyla o hastaya ait çakışma sorunu
zaman içinde kendiliğinden kapanmıyor.

Bu karar ve gerekçesi `phone.ts` başındaki yorum bloğuna da yazılır — sonraki
geliştirici "bu fonksiyon neden hâlâ son 10 hane alıyor" diye değiştirmeye
kalkmasın diye.

## 6. Testler

`src/domain/__tests__/phone.test.ts` genişletilir. Mevcut 8 `normalizePhone`
testi **olduğu gibi kalır** — o fonksiyonun davranışı değişmiyor.

- **`toE164`** — §3.1 tablosunun altı satırı; ayrıca Suudi ve Rus numaraları,
  `00` öneki, çoklu baştaki sıfır, yalnız boşluktan oluşan girdi.
- **`hasExplicitCountryCode`** — `+` ile, `00` ile, `905321112233` (5. kural),
  çıplak ulusal, boş.
- **`isValidPhone`** — TR ulusal 10 hane geçer; `12345678` elenir;
  `+45 12345678` geçer; 16 haneli elenir.
- **Regresyon testi** — `normalizePhone(toE164(x)) === normalizePhone(x)`.
  E.164'e geçişin DB'nin son-10 eşleştirmesini bozmadığını sabitler; §5
  kararının dayandığı varsayım budur.

Sihirbaz için bileşen testi yazılmaz — depodaki mevcut desen saf domain birim
testi ağırlıklı ve değişen mantığın tamamı domain katmanında.
