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

## 3. Doktor Profil Kartı Zenginleştirme (FR-46, FR-47, FR-48, §7.3)

### 3.1 Çoklu yetkinlik modeli — KRİTİK değişiklik (many-to-many)

Bir doktor bir kategori içinde **birden çok alt kırılım** yapabilir ama hepsini değil (ör. plastik cerrah **meme + vücut + yüz** yapar, **burun** yapmaz; **genital estetik** hiç yapmaz). M1'deki tek `doctor.subcategory_id` bunu ifade edemez. Yeni model:

```
doctor_scope   id, tenant_id, doctor_id,
               category_id,
               subcategory_id (nullable — alt-kırılımsız kategoriler için null)
               unique(doctor_id, category_id, subcategory_id)
```

- Bir doktorun **1+ scope satırı** olur (yaptığı her kategori/alt-kırılım bir satır).
- Örnek plastik cerrah: (Plastik, Meme), (Plastik, Vücut), (Plastik, Yüz) — 3 satır; Burun ve Genital için satır **yok**.
- Alt-kırılımsız kategoriler (Saç Ekimi, Diş, Boy Uzatma…): tek satır (kategori, null).
- Doktor birden çok kategoriye de yayılabilir (farklı category_id'li satırlar).
- **Geçiş:** M1'deki `doctor.category_id`/`subcategory_id` kolonları `doctor_scope`'a taşınır (seed doktorları için birer satır); eski kolonlar kaldırılır veya bırakılır (implementation kararı).

**Atama mantığı (`resolveAssignees`) değişir:** hedef (category, subcategory) için, o hedefe uyan **scope satırı** olan aktif doktorlar seçilir:
`aktif && bir scope satırı (category_id = hedef.category AND (subcategory_id = hedef.subcategory OR (hedef.subcategory IS NULL AND subcategory_id IS NULL)))`.
Bu saf fonksiyon TDD ile güncellenir (imza scope listesi alacak şekilde değişir). `useRequests` (ilk atama) ve `AllRequests` (yeniden atama) bu yeni mantığı kullanır.

### 3.2 Doktor kartı içeriği

Düzenlenebilir alanlar:
- **Fotoğraf** (Storage'a yükleme)
- **Ad, unvan** (title), **branş** (specialty)
- **CV / biyografi** (bio — deneyim, eğitim, öne çıkanlar; çok satırlı)
- **Yetkinlikler** (`doctor_scope`): kategori seçilir, o kategorinin alt kırılımları **çoklu seçilir** (checkbox); alt-kırılımsız kategoride sadece kategori işaretlenir. Eklenip çıkarılabilir.
- **Ağırlıklı işler** (`weighted_work`): etiketli satırlar `{ area, level: yüksek|orta|düşük }` + serbest not; M2 AI bağlamını besler (FR-48).
- **Aktif/Pasif**
- **Düzenleme:** kart güncellenir, değişiklik audit'e yazılır (FR-49).

`weighted_work` yapısı:
```
weighted_work: { items: [{ area: string, level: 'high'|'medium'|'low' }], note: string }
```

### 3.3 Doktor kartı — performans paneli (hesaplanan, salt-okunur)

Kartın alt kısmında, tanımlama alanlarından ayrı, **sonuç** olarak gösterilir (ilk tanımlamada boş/sıfır, zamanla dolar):

| Metrik | Kaynak |
|--------|--------|
| Kabul sayısı | `response` (decision=accept, doctor_id) |
| Red sayısı | `response` (decision=reject, doctor_id) |
| Ortalama dönüş süresi | avg(`response.responded_at` − `assignment.assigned_at`) |
| Dönüş skoru | `doctor.score` (M3'te otomatikleşir; M1.5 mevcut değeri gösterir) |

Bu metrikler mevcut M1 verisinden **anlık sorguyla** hesaplanır (yeni tablo gerekmez). Skorun otomatik +1/−1 güncellenmesi ve SLA takibi **M3** kapsamıdır; M1.5 yalnız `doctor.score` değerini ve hesaplanan sayıları/süreyi gösterir.

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
- **`resolveAssignees` çoklu-yetkinlik güncellemesi (TDD):** doktor artık scope listesiyle temsil edilir; hedef alt kırılım doktorun scope'unda varsa aday. Test: plastik cerrah (meme+vücut+yüz scope'lu) → Meme talebine düşer, Burun talebine **düşmez**; alt-kırılımsız kategori scope'u null-eşleşir. Mevcut `assignment.test.ts` bu modele göre yeniden yazılır.
- **Performans metrikleri:** kabul/red sayısı + ortalama dönüş süresi hesaplayan saf yardımcı (varsa) test edilir.
- **Canlı doğrulama:** yeni alanlarla talep → doktor görünümünde tüm bilgiler + foto + (Diş) röntgen; koordinatör alt-kırılımlı doktor tanımlar → o alt kırılımda talep artık atanır; create-doctor ile eklenen doktor giriş yapıp yanıtlayabilir.
- **İzin sınırı:** aracı yeni alanları/fotoları kendi talebinde görür ama doktor planını görmez (M1 kuralı korunur).

---

## 7. Açık Noktalar (bloke etmez)
- `gender` enum değerleri: `female|male|other` (UI: Kadın/Erkek/Diğer). Gerekirse "belirtilmemiş" eklenebilir.
- Doktor foto yükleme için ayrı bir bucket mı yoksa `photos` bucket'ında `doctors/` öneki mi — implementation'da netleşir (öneri: ayrı `doctor-photos` public-olmayan bucket ya da mevcut bucket'ta önek).
- create-doctor geçici şifre politikası (ilk girişte değiştirme M6/ilerisi).
