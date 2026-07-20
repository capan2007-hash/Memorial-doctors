# Doktor Öz-Profili — Tasarım

Tarih: 2026-07-20 · Kullanıcı isteği: doktor kendi profilini görsün + içerik/verebileceği tedavileri (yetkinlik) kendisi değiştirsin/güncellesin/onaylasın + kendi performansını görsün. Web + mobil. Yetki kararı: **doğrudan öz-yönetim** ("onaylayabilsin" — koordinatör ara-onayı yok), her değişiklik audit'li.

## Güvenlik yaklaşımı
Doktora doğrudan `doctor` UPDATE RLS'i VERİLMEZ (skor güncelleme apply_score_event ile çakışır; ayrıca skor/aktiflik korunmalı). Yerine **whitelist'li SECURITY DEFINER RPC'ler** — doktor yalnız kendi izinli alanlarını değiştirir.

## Migration 0027
- `update_own_doctor_profile(p_title, p_specialty, p_bio, p_weighted_work jsonb, p_photo_url)` — role='doctor', `doctor set title/specialty/bio/weighted_work/photo_url where id=current_doctor_id()`. Skor/is_active/tenant_id/app_user_id/category_id DOKUNULMAZ. audit 'doctor_self_update'. revoke public/anon, grant authenticated.
- `set_own_doctor_scopes(p_scopes jsonb)` — role='doctor'; kendi doctor_scope'unu yeniden yaz (set_doctor_scopes deseni ama current_doctor_id()). En az 1 scope zorunlu (aksi halde talep düşmez). audit 'doctor_self_scopes'.
- `own_doctor_performance()` — role in ('doctor') → current_doctor_id için tek satır; doctor_performance_summary ile aynı şekil (score, accept/reject, avg_response_mins, timely/breach, pending). SECURITY DEFINER tenant-scoped.
- RLS: `scope_self_read` on doctor_scope for select using (tenant_id=current_tenant_id() and doctor_id=current_doctor_id()) — doktor kendi yetkinliklerini okusun (şu an yalnız koord/admin okuyor).

## Web (`/profil`, doctor RoleGate)
Premium (Rafine Klinik token'ları). Üç bölüm:
1. **Profil kartı + düzenleme:** unvan, branş, bio, foto (uploadDoctorPhoto mevcut — sanitize+UUID), ağırlıklı işler (WeightedWork editörü, DoctorAdmin'deki gibi). Kaydet → update_own_doctor_profile. Foto photo_url'e yazılır (update_own_doctor_profile p_photo_url).
2. **Yetkinlikler (verebileceği tedaviler):** kategori/alt-kırılım çip toggle'ları (DoctorAdmin scope seçicisi mantığı); Kaydet/Onayla → set_own_doctor_scopes. "Bu tedaviler için talep alırsınız" açıklaması.
3. **Performansım:** own_doctor_performance kartı — gelen (accept+reject+pending?), cevaplanan (accept+reject), ort. yanıt süresi, hedef-dışı (breach) sayısı, skor (renk kademesi + <10 "Çalışılmaz"). Dönemsel skor (score_event, kendi okur) opsiyonel mini.
Route: `/profil`; nav'a doktor için "Profilim" linki.

## Mobil (Profil sekmesi/ekranı)
Aynı üç bölüm, RN premium (useTheme). Yeni tab "Profil" (veya Ayarlar içinde genişletme — yeni tab tercih: (tabs)/profile.tsx). Foto yükleme mobilde expo-image-picker gerekebilir → KAPSAM: mobilde foto düzenleme HARİÇ (yalnız görüntüleme); profil metin alanları + yetkinlik + performans düzenlenir. (Foto düzenleme sonraki tur.)

## Kapsam dışı
Koordinatör onay akışı (doğrudan öz-yönetim seçildi); mobilde foto çekme/yükleme; yetkinlik değişikliğinin açık talepleri yeniden yönlendirmesi (yalnız yeni talepler etkilenir — mevcut atamalar durur).

## Test & doğrulama
- Birim: performans/yetkinlik saf mantığı (varsa). RLS/RPC canlı token testi (doktor kendi profilini/scope'unu değiştirir; başka doktorunkini DEĞİŞTİREMEZ; skor/is_active değişmez).
- Canlı: doktor girişiyle /profil — profil düzenle+kaydet, yetkinlik değiştir+onayla, performans görünür; başka doktorun profilini RPC ile değiştirme denemesi reddedilir. Web 153 + mobil jest + E2E yeşil.
