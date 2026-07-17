# MedTriage — M1.5: Talep & Doktor Kartı Zenginleştirme (Tasarım Spec'i)

**Tarih:** 2026-07-17
**Sürüm:** 1.0
**Kaynak:** MedTriage BRD v2.0 (FR-1, FR-4, FR-46, FR-47, FR-48, §7.3)
**Önkoşul:** M1 (çekirdek talep döngüsü) — tamamlandı.
**Kapsam:** M1.5 — talep girişini ve doktor profil kartını BRD'ye tam uydurma; doktor & satışçı görünümlerini zenginleştirme. M2'den (AI triyaj) önce yapılır; çünkü demografi + doktor kartı M2'nin girdisidir.

---

## 1. Amaç

M1 çekirdek döngüyü kurdu ama talep girişinde yalnız ad/soyad topladı ve doktor kartı iskelet kaldı. Bu tur:
1. **Talep girişini** BRD FR-1/FR-4'e uydurur (demografi + tıbbi geçmiş + Diş röntgeni).
2. **Doktor profil kartını** BRD §7.3'e uydurur (alt kırılım, branş, biyografi, ağırlıklı işler, foto, giriş hesabı) — böylece alt-kırılımlı kategoriler (Plastik/Obezite) atanabilir ve M2 AI triyajı doktor bağlamına sahip olur (FR-48).
3. **Doktor ve satışçı görünümlerini** zenginleştirir (hasta bilgisi + kategori/operasyon + fotoğraflar).
4. Atanamayan (sıfır uygun doktor) talepleri koordinatör panosunda **görünür** kılar.

---

## 2. Talep Girişi Zenginleştirme (FR-1, FR-4)

### 2.1 Yeni alanlar — `request` tablosuna (başvuru-bazlı snapshot)

Demografi ve tıbbi bilgi talep anında girilir (kilo/ilaç zamanla değişir; kalıcı `patient` yerine `request`'te snapshot).

| Alan | Tip | Zorunluluk |
|------|-----|-----------|
| `age` | int | **Zorunlu** (>0, makul aralık) |
| `weight_kg` | numeric | **Zorunlu** (>0) |
| `height_cm` | int | **Zorunlu** (>0) |
| `gender` | enum `female \| male \| other` | **Zorunlu** |
| `past_surgeries` | text not null | **Zorunlu-metin** ("Yok" ya da metin) |
| `known_conditions` | text not null | **Zorunlu-metin** ("Yok" ya da metin) |
| `medications` | text not null | **Zorunlu-metin** ("Yok" ya da metin) |

**"Yok" davranışı:** üç tıbbi alan boş bırakılamaz. UI'da her biri için **"Yok"** onay kutusu; işaretliyse değer `"Yok"` olarak kaydedilir, değilse metin zorunludur. Böylece "veri girilmedi" ile "yok" ayrışır ve alanlar her zaman anlamlı dolar.

### 2.2 Diş röntgeni (opsiyonel, kategoriye bağlı)

- `photo` tablosuna `kind` kolonu: enum `photo | xray`, default `photo`.
- Wizard'da **kategori = Diş Tedavisi** seçilirse ek bir **"Diş röntgeni (opsiyonel)"** yükleyici görünür; buradan yüklenenler `kind='xray'` işaretlenir. Diğer kategorilerde görünmez, zorunlu değildir.
- Depolama, RLS ve silme M1 fotoğraf yolunu aynen kullanır (bucket, tenant-scoped path).

### 2.3 Form (satışçı/aracı) — `NewRequestWizard`

Mevcut alanlar (ad, soyad, kategori, alt kırılım, operasyon tipi, not, foto) + yukarıdaki demografi/tıbbi alanlar + (Diş ise) röntgen. `canSubmit`: ad, soyad, yaş, boy, kilo, cinsiyet, kategori (gerekiyorsa alt kırılım), üç tıbbi alan (Yok veya metin) ve en az bir fotoğraf.

---

## 3. Doktor Profil Kartı Zenginleştirme (FR-46, FR-47, §7.3)

### 3.1 `doctor` tablosu — mevcut kolonlar zaten var, ekranı bunları kullanacak

Şema M1'de zaten şu kolonlara sahip: `photo_url, title, specialty, category_id, subcategory_id, bio, weighted_work(jsonb), score, is_active, app_user_id`. M1.5 bunları **ekranda** kullanır (şu an yalnız title+category yazılıyor). Ek şema değişikliği gerekmeyebilir; `weighted_work` yapısı netleştirilir:

```
weighted_work: [{ area: string, level: 'high'|'medium'|'low' }]  + serbest metin notu (bio içine veya ayrı)
```

### 3.2 `DoctorAdmin` ekranı zenginleştirme

Koordinatör bir doktor eklerken/düzenlerken:
- **Ad, unvan** (title)
- **Branş** (specialty) — serbest metin
- **Kategori** + (kategori alt-kırılımlıysa) **alt kırılım** seçimi → **atama bunun üzerinden çalışır** (bugünkü Meme sorununu çözer)
- **Biyografi** (bio)
- **Ağırlıklı işler** — etiketli satırlar: alan + seviye(yüksek/orta/düşük), birden çok; M2 AI bağlamını besler
- **Fotoğraf** (opsiyonel, Storage'a yükleme)
- **Aktif/Pasif**
- **Düzenleme:** mevcut doktor kartı güncellenebilir (audit'e yazılır — FR-49).

### 3.3 Doktor giriş hesabı (davet-bazlı, FR-57)

Eklenen doktorun **giriş yapabilmesi** için bir Auth hesabı gerekir. Client anon anahtarıyla Auth kullanıcısı oluşturamaz; bu yüzden:
- **Edge Function `create-doctor`** (service role): koordinatörden e-posta + geçici şifre + profil bilgilerini alır; `auth.users` + `app_user(role='doctor')` + `doctor` profilini atomik oluşturur/bağlar.
- Alternatif: mevcut (girişi olan) bir `doctor`-rol kullanıcıyı profile bağlama. MVP'de **create-doctor** ana yol.
- Bu, BRD §11.2 "hesaplar yalnız admin/koordinatör tarafından oluşturulur" ilkesine uyar.

---

## 4. Görünüm Zenginleştirme

### 4.1 Doktor görünümü (`DoctorRequestView`)
Ekle: hasta ad-soyad, kategori/alt kırılım, istenen operasyon, **yaş/boy/kilo/cinsiyet + otomatik BMI**, geçmiş ameliyat/hastalık/ilaç, fotoğraflar; **Diş** ise röntgenler ayrı bölümde. (AI uyarıları M2'de eklenecek — yer bırakılır.)

### 4.2 Satışçı/oluşturan görünümü (`RequestDetail`)
Şu an foto/hasta bilgisi göstermiyor. Ekle: aynı hasta bilgisi (demografi + tıbbi + kategori/operasyon) + **fotoğraflar** (salt-okunur). Doktor planı görünürlüğü M1'deki gibi (aracı görmez).

### 4.3 Koordinatör — atanamayan talepler
`AllRequests`/gecikme panosunda **`status='submitted'` (atanmadı)** talepler belirgin işaretlenir ("Doktor atanmadı" rozeti) ki takılı kalanlar (ör. alt-kırılımda doktoru olmayan) görülüp manuel atanabilsin.

### 4.4 Rol-farkında navigasyon menüsü (M1 eksiği)
M1'de `Layout` yalnız uygulama adı + kullanıcı + Çıkış içeriyor; admin ekranları (`/admin/doctors`, `/admin/requests`) yalnız URL ile ulaşılabiliyor. `Layout` header'ına role göre gezinme linkleri eklenir:
- **satışçı/aracı:** Talepler, Yeni Talep
- **doktor:** Bekleyen Talepler
- **koordinatör/admin:** Tüm Talepler, Doktor Yönetimi
Böylece koordinatör doktor tanımlama ekranına menüden ulaşır (bugünkü "ekran görünmüyor" sorunu).

---

## 5. Güvenlik / RLS
- Yeni `request` kolonları mevcut `request` RLS'ine tabidir (değişiklik yok).
- `photo.kind` mevcut foto RLS'ine tabidir.
- `create-doctor` Edge Function service role ile çalışır; yalnız koordinatör/admin çağırabilir (fonksiyon içinde çağıranın rolü doğrulanır).
- Doktor kartı düzenleme koordinatör/admin ile sınırlı (mevcut `doctor_admin_all` politikası).

---

## 6. Domain / Test
- **Saf domain:** `bmi(weightKg, heightCm)`, demografi/tıbbi alan doğrulaması (zorunlu + "Yok" mantığı), `weighted_work` normalize — TDD birim testleri.
- **Canlı doğrulama:** yeni alanlarla talep → doktor görünümünde tüm bilgiler + foto + (Diş) röntgen; koordinatör alt-kırılımlı doktor tanımlar → o alt kırılımda talep artık atanır; create-doctor ile eklenen doktor giriş yapıp yanıtlayabilir.
- **İzin sınırı:** aracı yeni alanları/fotoları kendi talebinde görür ama doktor planını görmez (M1 kuralı korunur).

---

## 7. Açık Noktalar (bloke etmez)
- `gender` enum değerleri: `female|male|other` (UI: Kadın/Erkek/Diğer). Gerekirse "belirtilmemiş" eklenebilir.
- Doktor foto yükleme için ayrı bir bucket mı yoksa `photos` bucket'ında `doctors/` öneki mi — implementation'da netleşir (öneri: ayrı `doctor-photos` public-olmayan bucket ya da mevcut bucket'ta önek).
- create-doctor geçici şifre politikası (ilk girişte değiştirme M6/ilerisi).
