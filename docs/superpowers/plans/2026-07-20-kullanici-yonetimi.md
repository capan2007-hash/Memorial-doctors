# Kullanıcı Yönetimi + Şifre Sıfırlama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Koordinatör/admin'in sales/agent/coordinator hesabı açabilmesi + herkes için admin şifre sıfırlama/pasifleştirme + self-servis "şifremi unuttum" (SMTP ile).

**Architecture:** create-doctor deseninden `create-user` + `manage-user` edge fn (service-role, RBAC, rollback, audit); app_user'a email kolonu; "Kullanıcı Yönetimi" ekranı; LoginPage forgot-password + public `/reset` sayfası.

**Tech Stack:** Deno edge fn, Supabase Auth admin API, React+TS+TanStack Query+Tailwind, vitest.

## Global Constraints
- Auth mutasyonları YALNIZ service-role edge fn; app_user client yazma yok (korunur).
- RBAC sunucuda: coordinator → oluştur {sales,agent}, yönet {sales,agent,doctor}; admin → hepsi. Koordinatör coordinator/admin'e dokunamaz.
- Kendini/son aktif admin'i pasifleştirme engeli.
- Şifre uygulama tablosunda saklanmaz. Tenant izolasyonu. Migration canlı (ref `oxibdniwobetaksuxacs`). Kimlik=e-posta.

---

### Task 1: Migration 0032 — app_user.email + backfill + rol-izin domain

**Files:** Create `supabase/migrations/0032_user_email.sql`; Modify `src/types/db.ts` (AppUserRow); Create `src/domain/userRoles.ts` + `src/domain/__tests__/userRoles.test.ts`.

- [ ] **Step 1:** Migration:
```sql
alter table app_user add column email text;
update app_user au set email = u.email from auth.users u where u.id = au.id;
```
- [ ] **Step 2:** `apply_migration` name `0032_user_email`. Doğrula: `select count(*) from app_user where email is not null` = tüm kullanıcı sayısı.
- [ ] **Step 3:** `AppUserRow`'a `email: string | null` ekle (src/types/db.ts).
- [ ] **Step 4 (TDD):** `src/domain/__tests__/userRoles.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { creatableRoles, canManageTarget, roleLabel } from '../userRoles'

describe('userRoles', () => {
  it('oluşturulabilir roller', () => {
    expect(creatableRoles('coordinator')).toEqual(['sales', 'agent'])
    expect(creatableRoles('admin')).toEqual(['sales', 'agent', 'coordinator', 'admin'])
    expect(creatableRoles('sales')).toEqual([])
  })
  it('yönetim yetkisi (sıfırla/pasifleştir)', () => {
    expect(canManageTarget('coordinator', 'sales')).toBe(true)
    expect(canManageTarget('coordinator', 'doctor')).toBe(true)
    expect(canManageTarget('coordinator', 'coordinator')).toBe(false)
    expect(canManageTarget('coordinator', 'admin')).toBe(false)
    expect(canManageTarget('admin', 'coordinator')).toBe(true)
    expect(canManageTarget('admin', 'admin')).toBe(true)
    expect(canManageTarget('sales', 'agent')).toBe(false)
  })
  it('rol etiketi', () => {
    expect(roleLabel('coordinator')).toBe('Koordinatör')
    expect(roleLabel('sales')).toBe('Satışçı')
    expect(roleLabel('agent')).toBe('Aracı')
  })
})
```
- [ ] **Step 5:** FAIL doğrula → `src/domain/userRoles.ts`:
```ts
import type { Role } from '../types/domain'

const CREATABLE: Record<Role, Role[]> = {
  admin: ['sales', 'agent', 'coordinator', 'admin'],
  coordinator: ['sales', 'agent'],
  sales: [], agent: [], doctor: [],
}
export function creatableRoles(caller: Role): Role[] { return CREATABLE[caller] ?? [] }

// Sıfırla/pasifleştir yetkisi: admin herkesi; koordinatör yalnız operasyonel (sales/agent/doctor).
export function canManageTarget(caller: Role, target: Role): boolean {
  if (caller === 'admin') return true
  if (caller === 'coordinator') return ['sales', 'agent', 'doctor'].includes(target)
  return false
}

const LABELS: Record<Role, string> = {
  admin: 'Yönetici', coordinator: 'Koordinatör', doctor: 'Doktor', sales: 'Satışçı', agent: 'Aracı',
}
export function roleLabel(r: Role): string { return LABELS[r] }
```
- [ ] **Step 6:** PASS + `npx tsc --noEmit`. Commit `feat(users): app_user.email + rol-izin domain + testler`.

---

### Task 2: `create-user` edge fonksiyonu

**Files:** Create `supabase/functions/create-user/index.ts`.

**Interfaces:** Produces edge fn `create-user` `{ email, password, fullName, phone?, role } → { userId }`.

- [ ] **Step 1:** Yaz (create-doctor deseni; RBAC sunucuda — creatableRoles mantığının SQL/JS ikizi inline):
```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const CREATABLE: Record<string, string[]> = { admin: ['sales','agent','coordinator','admin'], coordinator: ['sales','agent'] }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!, serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userRes } = await caller.auth.getUser()
  if (!userRes?.user) return json({ error: 'unauthorized' }, 401)
  const { data: me } = await caller.from('app_user').select('tenant_id, role').eq('id', userRes.user.id).single()
  if (!me || !['coordinator','admin'].includes(me.role)) return json({ error: 'forbidden' }, 403)

  const body = await req.json().catch(() => null)
  if (!body) return json({ error: 'bad json' }, 400)
  const { email, password, fullName, phone, role } = body
  if (!email || !password || !fullName || !role) return json({ error: 'missing fields' }, 400)
  if (!(CREATABLE[me.role] ?? []).includes(role)) return json({ error: 'role not allowed' }, 403)

  const admin = createClient(url, serviceKey)
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (cErr || !created?.user) return json({ error: cErr?.message ?? 'create failed' }, 400)
  const uid = created.user.id
  const { error: auErr } = await admin.from('app_user').insert({ id: uid, tenant_id: me.tenant_id, role, full_name: fullName, phone: phone ?? null, email })
  if (auErr) { await admin.auth.admin.deleteUser(uid).catch(() => {}); return json({ error: auErr.message }, 400) }
  await admin.from('audit_log').insert({ tenant_id: me.tenant_id, actor_id: userRes.user.id, action: 'user_create', entity: 'app_user', after: { user_id: uid, role } }).catch(() => {})
  return json({ userId: uid }, 200)
})
function json(o: unknown, status: number) { return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }
```
- [ ] **Step 2:** `deploy_edge_function` name `create-user` (verify_jwt true).
- [ ] **Step 3:** Canlı doğrula (koordinatör JWT simülasyonu zor → E2E'ye bırak; en azından fn ACTIVE). Koordinatör coordinator açmaya çalışırsa 403 (RBAC birim testi Task 1'de).
- [ ] **Step 4:** Commit `feat(users): create-user edge fn (RBAC + rollback + audit)`.

---

### Task 3: `manage-user` edge fonksiyonu (reset_password + set_active)

**Files:** Create `supabase/functions/manage-user/index.ts`.

- [ ] **Step 1:** Yaz — authz coordinator/admin; hedef aynı tenant; canManageTarget kuralı; son-admin/kendini koruma:
  - `reset_password` `{ userId, password }` → `admin.auth.admin.updateUserById(userId, { password })`, audit `user_password_reset`.
  - `set_active` `{ userId, isActive }` → hedef app_user (aynı tenant) çek, canManageTarget(caller.role, target.role) yoksa 403; isActive=false ve (userId==caller || hedef 'admin' ve tenant'ta başka aktif admin yok) → 400; `app_user.is_active` güncelle; audit `user_set_active`.
- [ ] **Step 2:** `deploy_edge_function` name `manage-user`.
- [ ] **Step 3:** Commit `feat(users): manage-user edge fn (şifre sıfırla + pasifleştir, guard'lar)`.

---

### Task 4: create-doctor'a email yaz (tutarlılık)

**Files:** Modify `supabase/functions/create-doctor/index.ts`.

- [ ] **Step 1:** app_user insert'ine `email` ekle (satır 46-48). Deploy create-doctor (index.ts).
- [ ] **Step 2:** Commit `feat(users): create-doctor app_user.email yazar`.

---

### Task 5: Kullanıcı Yönetimi ekranı (Faz 1)

**Files:** Create `src/features/admin/useUsers.ts`, `src/features/admin/UserAdmin.tsx`; Modify `src/App.tsx`, `src/lib/nav.ts`, `src/components/Layout.tsx`.

- [ ] **Step 1:** `useUsers.ts`: `useUsers()` (`app_user` select ad/email/rol/is_active, created_at desc), `useCreateUser()` (invoke create-user), `useManageUser()` (invoke manage-user; invalidate ['users']).
- [ ] **Step 2:** `UserAdmin.tsx`: PageHeader "Kullanıcı Yönetimi"; liste (ad/email/rol rozeti/durum + aksiyonlar). "Yeni kullanıcı" dialogu (email/ad/telefon/rol[creatableRoles(role) ile sınırlı]/geçici şifre → useCreateUser). Satır aksiyonları: "Şifre sıfırla" (geçici şifre input modal → reset_password), "Pasifleştir/Aktifleştir" (set_active). Doktor satırında oluşturma yok, sıfırla/pasifle var; üstte "Doktor eklemek için Doktor Yönetimi" notu. useToast; canManageTarget ile UI kısıtı. Premium (Rafine Klinik token, lucide).
- [ ] **Step 3:** Route `/admin/users` (RoleGate ['coordinator','admin']) + import; nav "Kullanıcı Yönetimi" (koordinatör/admin dizisi); Layout NAV_ICONS `'/admin/users': UserCog`.
- [ ] **Step 4:** `npx tsc --noEmit && npx vitest run` yeşil.
- [ ] **Step 5:** Canlı görsel (Playwright, iki tema): koordinatörle /admin/users, yeni kullanıcı dialogu + liste ekran görüntüsü.
- [ ] **Step 6:** Commit `feat(users): Kullanıcı Yönetimi ekranı (oluştur/listele/sıfırla/pasifleştir)`.

---

### Task 6: Faz 2 — self-servis şifremi unuttum + /reset (kod hazır)

**Files:** Modify `src/features/auth/LoginPage.tsx`, `src/App.tsx`; Create `src/features/auth/ResetPasswordPage.tsx`.

- [ ] **Step 1:** LoginPage: "Şifremi unuttum?" linki/aç-kapa → e-posta input + "Sıfırlama bağlantısı gönder" → `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset' })` → "E-posta gönderildiyse bağlantı ulaşacak" bilgi mesajı (kullanıcı sayımı sızdırmamak için nötr).
- [ ] **Step 2:** `ResetPasswordPage.tsx`: mount'ta `supabase.auth.onAuthStateChange` 'PASSWORD_RECOVERY' veya mevcut recovery oturumu; yeni şifre + tekrar formu (min uzunluk kontrolü) → `supabase.auth.updateUser({ password })` → başarı → /login. Geçersiz/eksik oturumda "Bağlantı geçersiz/süresi dolmuş" mesajı.
- [ ] **Step 3:** App.tsx: `<Route path="/reset" element={<ResetPasswordPage />} />` (Protected DIŞI).
- [ ] **Step 4:** `npx tsc --noEmit && npx vitest run && npm run build`.
- [ ] **Step 5:** Commit `feat(users): self-servis şifremi unuttum + /reset sayfası (SMTP ile aktif)`.

---

### Task 7: E2E + doğrulama + merge + deploy

**Files:** Create `tests/e2e/user-admin.spec.ts`.

- [ ] **Step 1:** E2E: koordinatör /admin/users → yeni sales kullanıcı (benzersiz email + geçici şifre) oluştur → listede görünür → yeni sales ile login başarılı. (Temizlik: test kullanıcısını sonra sil.)
- [ ] **Step 2:** `npx playwright test tests/e2e/user-admin.spec.ts`.
- [ ] **Step 3:** Tam: `npx tsc --noEmit && npx vitest run && npm run build`.
- [ ] **Step 4:** RLS: app_user client insert/update hâlâ reddediliyor (edge-only).
- [ ] **Step 5:** finishing-a-development-branch: merge → main; deploy; bellek güncelle. Test kullanıcısını DB'den temizle.

## Self-Review
- Kapsam: §Veri→T1; create-user→T2; manage-user→T3; create-doctor email→T4; ekran→T5; Faz2→T6; test→T1/T7.
- Tip tutarlılığı: Role union (admin/coordinator/doctor/sales/agent) her yerde; creatableRoles/canManageTarget JS (T1) ile edge fn RBAC (T2/T3) AYNI kural — edge fn'de inline kopya (Deno domain import edemez), kural birebir eşleşmeli.
- Faz 2 SMTP olmadan e-posta göndermez ama kod doğru; kullanıcı SMTP kurunca çalışır.
- Açık nokta: E2E'de yeni kullanıcı login testi gerçek auth kullanır; test email benzersiz + sonda silinir.
