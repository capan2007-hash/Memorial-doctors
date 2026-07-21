# Billing Faz 2 — Süper Admin + Billing Ekranı + Doktor Silme — Tasarım

**Tarih:** 2026-07-21 · **Durum:** Onaylandı (üst-plan) · **Kapsam:** Platform-üstü `super_admin` rolü; tüm firmaların AI maliyetini gösteren gerçek-zaman billing ekranı; doktor silme (soft).

## Amaç
Üst-plan (SaaS reseller) gereği platform sahibi için: (1) `super_admin` rolü — koordinatör/admin'in her şeyi + doktor ekle/**sil** + tüm lead'ler + billing; (2) firma-bazlı, servis-bazlı gerçek-zaman AI maliyeti + haftalık 2× tutar. Faz 1 `ai_usage` defterinin üstüne oturur.

## Kararlar (öneriyle, üst-plandan)
- **super_admin cross-tenant** verisi RLS'i BOZMADAN service-role `billing-admin` edge fn ile okunur (tüm tenant'ları toplar). RLS'e super_admin bypass eklenmez.
- İlk super_admin **elle seed** ile açılır (UI'dan super_admin oluşturmayı yalnız super_admin yapabilir — yetki-yükseltme engeli: admin super_admin OLUŞTURAMAZ).
- Faz 2 billing = **AI maliyeti (gerçek, ai_usage)** firma/servis bazlı + haftalık 2×. **Altyapı tahmini satırı Faz 3.**
- Doktor silme = **soft** (doctor.is_active=false + app_user.is_active=false + auth hesap ban). Geçmiş (yanıt/skor/atama) korunur.
- Billing dönemi gösterimi: **bu ISO hafta** (Pazartesi 00:00 UTC → şimdi) + 2×; ayrıca "bu ay" toplamı.

## Veri Modeli (migration 0035)
```sql
alter type user_role add value 'super_admin';
```
(Yeni tablo yok; billing ai_usage'dan türetilir. tenant.suspended vb. Faz 4.)

## Domain (src/domain/userRoles.ts güncelle)
- `creatableRoles`: super_admin → ['sales','agent','coordinator','admin','super_admin']; admin → ['sales','agent','coordinator','admin'] (super_admin YOK); coordinator → ['sales','agent'].
- `canManageTarget`: super_admin → herkes; admin → super_admin HARİÇ herkes; coordinator → sales/agent/doctor.
- `roleLabel`: super_admin → 'Süper Admin'.

## Sunucu: `billing-admin` edge fn
- Auth: caller role='super_admin' (getUser + app_user.role). Değilse 403. (create-doctor deseni; verify_jwt=true, browser-invoked.)
- Body: `{ period?: 'week'|'month' }` (varsayılan week).
- Service-role ile TÜM tenant'lar için ai_usage toplar:
  ```
  select t.id, t.name, u.service, sum(u.cost_usd) cost, count(*) calls, sum(input_tokens) in_tok, sum(output_tokens) out_tok
  from tenant t left join ai_usage u on u.tenant_id=t.id and u.created_at >= <period_start>
  group by t.id, t.name, u.service
  ```
- Dönüş: firma başına `{ tenantId, name, services: [{service, cost, calls}], totalCost, weeklyCharge: totalCost*2 }` + genel toplam.

## İstemci
### Billing ekranı `/admin/billing` (super_admin only)
- RoleGate allow={['super_admin']}. nav: super_admin case'ine "Billing" (lucide `CreditCard`/`Receipt`).
- `useBilling(period)` → billing-admin invoke. Premium tablo/kartlar: firma × servis maliyeti, toplam, **haftalık 2× tutar** (USD). Dönem seçici (bu hafta / bu ay). Boş/az veri durumu.
- Genel özet üstte: toplam AI maliyeti + toplam haftalık tahsilat (2×).

### Roller + görünürlük
- super_admin, admin'in gördüğü TÜM ekranları görür: App.tsx admin route'larının RoleGate allow'larına 'super_admin' eklenir; nav.ts'e super_admin case (admin menüsü + Billing).
- RBAC UI (UserAdmin): super_admin creatableRoles'a göre super_admin oluşturabilir.

### Doktor silme (soft)
- DoctorAdmin'e "Sil" aksiyonu (super_admin/admin görür). `delete-doctor` benzeri: yeni `manage-user` action `soft_delete_doctor` VEYA doctor'a özel. Basitlik: DoctorAdmin'de mevcut is_active toggle + yeni "Sil" = manage-user set_active(false) + auth ban. Aslında soft-delete = is_active=false (zaten var) + auth hesabı devre dışı. Yeni edge fn action: `ban_user` (auth.admin.updateUserById(banned_until)). Doktor "Sil" → is_active=false + ban. Geçmiş korunur.

## Güvenlik
- Cross-tenant okuma yalnız super_admin + service-role edge fn içinde.
- super_admin oluşturma yalnız super_admin (escalation engeli, sunucuda create-user RBAC'ta zorlanır — CREATABLE'a super_admin eklenir yalnız super_admin için).
- Doktor silme geri-döndürülemez auth-ban içerir; onay diyaloğu.

## Test
- Domain: creatableRoles/canManageTarget super_admin senaryoları.
- Edge: billing-admin super_admin 200 + doğru toplam; admin/coordinator 403.
- Canlı: seed super_admin → /admin/billing → ai_usage'dan maliyet + 2× görünür (iki tema).
- create-user: admin super_admin açamaz (403); super_admin açar.

## Kapsam Dışı (sonraki fazlar)
- Altyapı maliyet tahsisi (Faz 3). Stripe/kart/haftalık tahsilat/gating (Faz 4). Çoklu-tenant tenant-switcher (şimdilik billing tüm tenant'ları listeler).

## İlgili Kod
- src/domain/userRoles.ts · create-user/manage-user edge fn (RBAC) · App.tsx/nav.ts/Layout.tsx/RoleGate · DoctorAdmin.tsx · ai_usage (0033) · billing edge fn deseni = create-doctor auth.
