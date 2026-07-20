# Kullanıcı Yönetimi + Şifre Sıfırlama — Tasarım Spesifikasyonu

**Tarih:** 2026-07-20 · **Durum:** Onaylandı (kullanıcı) · **Kapsam:** Koordinatör/admin'in sales/agent/coordinator hesapları açması; herkes için şifre yönetimi; self-servis "şifremi unuttum".

## Amaç
Bugün yalnız `create-doctor` var (koordinatör doktor açar, geçici şifre yazar). sales/agent/coordinator hesapları yalnız elle seed ile açılıyor; şifre sıfırlama hiç yok. Bu özellik: (1) sales/agent/coordinator provizyonu, (2) tüm kullanıcılar için admin-sıfırlama + pasifleştirme, (3) self-servis e-posta şifre sıfırlama.

## Kilit Kararlar (onaylandı)
- **Kimlik = e-posta** (Supabase e-posta-tabanlı; ayrı kullanıcı adı katmanı yok). "Şifremi unuttum" **self-servis e-posta** (SMTP gerekir — kullanıcı Supabase dashboard'da kurar; kod hazır olur).
- **RBAC:** koordinatör → {sales, agent} oluşturur; admin → {sales, agent, coordinator, admin}. Koordinatör koordinatör/admin **açamaz** (yetki-yükseltme engeli). Doktor **oluşturma** "Doktor Yönetimi"nde kalır (yetkinlik/scope orada); Kullanıcı Yönetimi doktorları **listeler + sıfırlar + pasifleştirir**.
- **Faz 1** (e-posta gerektirmez): create-user + Kullanıcı Yönetimi ekranı (oluştur/listele/pasifleştir/admin-sıfırla). **Faz 2** (kod hazır, SMTP ile aktive): LoginPage "Şifremi unuttum" + `/reset` sayfası.

## Global Kısıtlar
- Tüm auth mutasyonları **yalnız service-role edge fn** (client asla) — mevcut `create-doctor` deseni. `app_user` client yazma politikası YOK, korunur.
- Şifre hiçbir uygulama tablosunda saklanmaz (Supabase Auth hash'ler).
- Rol-yükseltme guard sunucuda; kendini/son-admin pasifleştirme engeli.
- create/reset/deactivate → `audit_log`.
- Tenant izolasyonu: yeni kullanıcı çağıranın tenant'ında; başka tenant kullanıcısına dokunulamaz.
- `/reset` public route (Protected dışı, `/aydinlatma` gibi).

## Veri Modeli (migration 0032)
- `app_user` + `email text` kolonu (liste gösterimi; kaynak auth.users, edge fn senkron yazar). Mevcut satırlar auth.users'tan **backfill**:
  ```sql
  alter table app_user add column email text;
  update app_user au set email = u.email from auth.users u where u.id = au.id;
  ```
- Yeni RLS/politika gerekmez (tenant_read_appuser zaten var; yazma yok).

## Sunucu: Edge Fonksiyonları

### `create-user` (create-doctor deseni, rol-parametreli)
- Authz: caller `role ∈ {coordinator, admin}`.
- Body: `{ email, password, fullName, phone?, role }`. Zorunlu: email, password, fullName, role.
- **RBAC:** izinli hedef roller — coordinator → {sales, agent}; admin → {sales, agent, coordinator, admin}. Hedef rol izin dışıysa 403. (Doctor bu fn'den açılmaz — DoctorAdmin/create-doctor kullanılır.)
- `admin.auth.admin.createUser({ email, password, email_confirm: true })` → app_user insert `{ id, tenant_id, role, full_name, phone, email }`. Hata → auth user sil (rollback). Audit `user_create`.
- Dönüş `{ userId }`.

### `manage-user` (action-tabanlı)
- Authz: caller `role ∈ {coordinator, admin}` + hedef aynı tenant + RBAC (koordinatör yalnız {sales, agent, doctor} yönetir; koordinatör/admin hedefe koordinatör dokunamaz).
- Body: `{ userId, action, ... }`:
  - `action='reset_password'` `{ password }` → `admin.auth.admin.updateUserById(userId, { password })`. Audit `user_password_reset`.
  - `action='set_active'` `{ isActive }` → `app_user.is_active` güncelle. Kendini VEYA son aktif admin'i pasifleştirme → 400. Audit `user_set_active`.
- Dönüş `{ ok: true }`.

### `create-doctor` (küçük ek)
- app_user insert'ine `email: email` eklenir (liste tutarlılığı).

## İstemci (web)

### Faz 1 — Kullanıcı Yönetimi ekranı `/admin/users`
- Route `RoleGate allow={['coordinator','admin']}`; nav "Kullanıcı Yönetimi" (lucide `Users`/`UserCog`).
- `useUsers()` — `app_user` listesi (ad, email, rol, is_active), rol/aktiflik filtresi.
- `useCreateUser()` / `useManageUser()` — edge fn invoke.
- **Liste:** her satır ad/email/rol rozeti/durum + aksiyonlar: "Şifre sıfırla" (yeni geçici şifre modalı), "Pasifleştir/Aktifleştir". Doktor satırında oluşturma yok ama sıfırla/pasifle var; "Doktor eklemek için Doktor Yönetimi" ipucu.
- **Yeni kullanıcı dialogu:** email + ad + telefon + rol (açılır — çağıranın izinli rolleriyle sınırlı) + geçici şifre. Premium tasarım (Rafine Klinik).
- RBAC UI: rol açılırı ve aksiyonlar `useAuth().role`'a göre kısıtlı (sunucu da zorlar).

### Faz 2 — Self-servis sıfırlama (kod hazır; SMTP ile çalışır)
- LoginPage: "Şifremi unuttum?" linki → e-posta input → `supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset' })` → "E-posta gönderildi" mesajı (bloke etmez).
- Yeni `src/features/auth/ResetPasswordPage.tsx` + public route `/reset`: Supabase recovery oturumunu ('PASSWORD_RECOVERY' event / URL token) yakalar → yeni şifre + tekrar formu → `supabase.auth.updateUser({ password })` → başarı → /login.

## Mobil
- Doktor mobil app: **Faz 2 yalnız** — Ayarlar'a "Şifremi unuttum" (resetPasswordForEmail) eklenebilir (opsiyonel, bu turda kapsam dışı — web yeterli). Kullanıcı yönetimi web-only (koordinatör mobil yok).

## Test
- Edge fn (canlı, mevcut desen): create-user — koordinatör sales açar (200), koordinatör coordinator açmaya çalışır (403), rollback. manage-user — reset_password, set_active, son-admin koruma (400), koordinatör admin'e dokunamaz (403).
- RLS: app_user yazma hâlâ client'a kapalı.
- Domain/UI: rol-izin haritası (hangi rol hangi rolleri açar) saf fonksiyon + test.
- E2E: koordinatör Kullanıcı Yönetimi'nden sales açar → yeni sales giriş yapar.
- Faz 2: /reset sayfası recovery token'ıyla şifre günceller (SMTP olmadan token simülasyonu zor — manuel/sonra).

## Kapsam Dışı
- Ayrı kullanıcı adı katmanı (e-posta = kimlik).
- Mobil kullanıcı yönetimi.
- SMTP kurulumu (kullanıcı dashboard'da yapar — rehber ayrı verildi).
- E-posta ile davet akışı (inviteUserByEmail) — geçici-şifre modeli tercih edildi; ileride eklenebilir.

## İlgili Kod
- `supabase/functions/create-doctor/index.ts` (authz+rollback deseni) · `app_user` 0001_schema.sql · RLS 0002_rls.sql · `src/lib/auth.tsx` (signIn/AuthProvider) · `src/features/auth/LoginPage.tsx` · `src/features/admin/DoctorAdmin.tsx`/useDoctors.ts (create-doctor invoke deseni) · App.tsx/nav.ts/RoleGate.
