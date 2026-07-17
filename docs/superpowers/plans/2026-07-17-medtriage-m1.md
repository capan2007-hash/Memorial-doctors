# MedTriage M1 — Çekirdek Talep Döngüsü Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Talebin girilmesinden çoklu bağımsız doktor yanıtına kadar olan çekirdek döngüyü, gerçek Supabase (Postgres+RLS+Storage+Realtime+Auth) üstünde çalışan bir React web uygulaması olarak inşa etmek.

**Architecture:** Tek React (Vite+TS) uygulaması, role göre yönlendirme. Kritik iş mantığı UI'dan bağımsız saf `domain/` katmanında (TDD). Veri erişimi Supabase JS client + TanStack Query. Tenant izolasyonu ve rol bazlı erişim Postgres RLS ile. Bildirim M1'de Supabase Realtime tabanlı uygulama içi sayaç.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, @supabase/supabase-js, @tanstack/react-query, react-router-dom, Vitest, Playwright.

## Global Constraints

- **Dil:** Arayüz Türkçe öncelikli; kod/identifier İngilizce.
- **Multi-tenant:** Her tabloda `tenant_id`; tüm sorgular tenant-scoped; RLS zorunlu.
- **Rule = Data:** Atama/SLA kuralları koda gömülmez; kategori/tenant ayarında veri olarak tutulur.
- **İzin sınırı (FR-21):** `response.treatment_plan` ve doktor yanıtı aracı (`agent`) rolüne asla render edilmez/sorgulanmaz.
- **Sahiplenme YOK:** Bir talebe doktor başına bir `response`; birden çok kabul normaldir; `owned_by_doctor_id`/`is_owner` alanı yoktur (spec §2).
- **Roller:** `agent | sales | doctor | coordinator | admin`.
- **Self-signup kapalı:** Hesaplar yalnızca coordinator/admin tarafından oluşturulur.
- **Zaman damgaları:** Tüm durum geçişleri zaman damgalı (M3 SLA/skoru bunlardan türer).
- **Commit dili:** Türkçe conventional commit; her commit sonuna `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Dosya Yapısı

```
medtriage/
  .env.local                      # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  tailwind.config.js
  postcss.config.js
  playwright.config.ts
  supabase/
    migrations/
      0001_schema.sql             # tablolar + enum + indexler
      0002_rls.sql                # current_tenant_id() + RLS politikaları
    seed.sql                      # Rememore tenant, kategoriler, operasyon tipleri, örnek kullanıcı/doktor
  src/
    main.tsx
    App.tsx                       # router + query provider + auth provider
    index.css                     # tailwind
    lib/
      supabase.ts                 # supabase client (singleton)
      auth.tsx                    # AuthProvider + useAuth (session + app_user + rol)
      queryClient.ts
    types/
      db.ts                       # DB satır tipleri (elle; M2'de generate)
      domain.ts                   # domain tipleri (Request, Doctor, Response, Status)
    domain/
      status.ts                   # RequestStatus enum + nextStatus()
      assignment.ts               # resolveAssignees()
      decision.ts                 # applyDecision() -> aggregate durum
      __tests__/
        status.test.ts
        assignment.test.ts
        decision.test.ts
    features/
      auth/LoginPage.tsx
      requests/
        NewRequestWizard.tsx      # çok adımlı talep girişi
        RequestList.tsx           # role göre filtreli liste
        RequestDetail.tsx         # role göre görünüm (satışçı planları görür)
        usePhotoUpload.ts         # Storage upload helper
        useRequests.ts            # TanStack Query hooks
      doctor/
        DoctorQueue.tsx           # bekleyen kuyruk + realtime sayaç
        DoctorRequestView.tsx     # hasta+foto, kabul/red, tedavi planı
        usePendingCount.ts        # realtime pending counter
      admin/
        DoctorAdmin.tsx           # doktor tanımlama + kategoriye atama + havuz
        AllRequests.tsx           # tüm talepler + manuel yeniden atama
      catalog/
        useCatalog.ts             # kategori/alt kırılım/operasyon tipi okuma
    components/
      Layout.tsx  Badge.tsx  PhotoUploader.tsx  StatusPill.tsx  RoleGate.tsx
  tests/e2e/
    core-flow.spec.ts             # satışçı->doktor->satışçı + izin sınırı
```

---

## Task 1: Proje iskeleti (Vite + React + TS + Tailwind + test altyapısı)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `vitest.setup.ts`

**Interfaces:**
- Produces: çalışan `npm run dev`, `npm run test` (Vitest), `npm run build`.

- [ ] **Step 1: Vite React-TS iskeletini oluştur**

```bash
cd ~/Projects/medtriage
npm create vite@latest . -- --template react-ts
# "directory not empty" sorarsa mevcut docs/.git korunacak şekilde devam et (Ignore files / continue)
npm install
```

- [ ] **Step 2: Bağımlılıkları ekle**

```bash
npm install @supabase/supabase-js @tanstack/react-query react-router-dom
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test
npx tailwindcss init -p
```

- [ ] **Step 3: Tailwind'i yapılandır**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

`src/index.css` (baş kısmı):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Vitest yapılandırması**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
} as any)
```

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom'
```

`package.json` scripts bölümüne ekle:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test"
}
```

- [ ] **Step 5: Smoke test yaz**

`src/domain/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('smoke', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 6: Testi ve build'i doğrula**

Run: `npm run test`
Expected: PASS (1 test)

Run: `npm run build`
Expected: hatasız build.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Vite+React+TS+Tailwind proje iskeleti ve test altyapısı

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Domain — durum makinesi (`status.ts`)

**Files:**
- Create: `src/types/domain.ts`, `src/domain/status.ts`, `src/domain/__tests__/status.test.ts`

**Interfaces:**
- Produces:
  - `type RequestStatus = 'draft'|'submitted'|'assigned'|'in_review'|'offers_ready'|'escalated'|'closed'`
  - `type RequestEvent = 'submit'|'assign'|'seen'|'accept'|'reject_all'|'close'`
  - `function nextStatus(current: RequestStatus, event: RequestEvent): RequestStatus`

- [ ] **Step 1: Failing test yaz**

`src/domain/__tests__/status.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { nextStatus } from '../status'

describe('nextStatus', () => {
  it('submit: draft -> submitted', () => {
    expect(nextStatus('draft', 'submit')).toBe('submitted')
  })
  it('assign: submitted -> assigned', () => {
    expect(nextStatus('submitted', 'assign')).toBe('assigned')
  })
  it('seen: assigned -> in_review', () => {
    expect(nextStatus('assigned', 'seen')).toBe('in_review')
  })
  it('accept: in_review -> offers_ready', () => {
    expect(nextStatus('in_review', 'accept')).toBe('offers_ready')
  })
  it('accept: assigned -> offers_ready (görülmeden direkt kabul)', () => {
    expect(nextStatus('assigned', 'accept')).toBe('offers_ready')
  })
  it('reject_all: in_review -> escalated', () => {
    expect(nextStatus('in_review', 'reject_all')).toBe('escalated')
  })
  it('close: offers_ready -> closed', () => {
    expect(nextStatus('offers_ready', 'close')).toBe('closed')
  })
  it('geçersiz geçiş mevcut durumu korur', () => {
    expect(nextStatus('closed', 'assign')).toBe('closed')
  })
  it('offers_ready üstüne yeni kabul offers_ready kalır', () => {
    expect(nextStatus('offers_ready', 'accept')).toBe('offers_ready')
  })
})
```

- [ ] **Step 2: Testi çalıştır, fail görsün**

Run: `npx vitest run src/domain/__tests__/status.test.ts`
Expected: FAIL ("Cannot find module '../status'")

- [ ] **Step 3: Tipleri ve fonksiyonu yaz**

`src/types/domain.ts`:
```ts
export type Role = 'agent' | 'sales' | 'doctor' | 'coordinator' | 'admin'
export type RequestStatus =
  | 'draft' | 'submitted' | 'assigned' | 'in_review'
  | 'offers_ready' | 'escalated' | 'closed'
export type RequestEvent =
  | 'submit' | 'assign' | 'seen' | 'accept' | 'reject_all' | 'close'
export type Decision = 'accept' | 'reject'
export type SaleStatus = 'not_completed' | 'sale_done' | 'operation_done'
```

`src/domain/status.ts`:
```ts
import type { RequestStatus, RequestEvent } from '../types/domain'

const TRANSITIONS: Record<RequestStatus, Partial<Record<RequestEvent, RequestStatus>>> = {
  draft:        { submit: 'submitted' },
  submitted:    { assign: 'assigned' },
  assigned:     { seen: 'in_review', accept: 'offers_ready', reject_all: 'escalated' },
  in_review:    { accept: 'offers_ready', reject_all: 'escalated' },
  offers_ready: { accept: 'offers_ready', close: 'closed' },
  escalated:    { close: 'closed' },
  closed:       {},
}

export function nextStatus(current: RequestStatus, event: RequestEvent): RequestStatus {
  return TRANSITIONS[current]?.[event] ?? current
}
```

- [ ] **Step 4: Testi çalıştır, pass görsün**

Run: `npx vitest run src/domain/__tests__/status.test.ts`
Expected: PASS (9 test)

- [ ] **Step 5: Commit**

```bash
git add src/types/domain.ts src/domain/status.ts src/domain/__tests__/status.test.ts
git commit -m "feat: talep durum makinesi (nextStatus) + testleri

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Domain — atama çözümü (`assignment.ts`)

**Files:**
- Create: `src/domain/assignment.ts`, `src/domain/__tests__/assignment.test.ts`

**Interfaces:**
- Consumes: `Role` (domain.ts)
- Produces:
  - `interface AssignableDoctor { id: string; categoryId: string; subcategoryId: string | null; isActive: boolean }`
  - `interface AssignmentTarget { categoryId: string; subcategoryId: string | null }`
  - `function resolveAssignees(target: AssignmentTarget, doctors: AssignableDoctor[]): string[]` — hedef kategori/alt kırılıma tanımlı aktif doktorların id listesi. Alt kırılım varsa hem categoryId hem subcategoryId eşleşmeli; alt kırılım yoksa yalnız categoryId.

- [ ] **Step 1: Failing test yaz**

`src/domain/__tests__/assignment.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveAssignees, type AssignableDoctor } from '../assignment'

const docs: AssignableDoctor[] = [
  { id: 'd1', categoryId: 'sac', subcategoryId: null, isActive: true },
  { id: 'd2', categoryId: 'sac', subcategoryId: null, isActive: true },
  { id: 'd3', categoryId: 'sac', subcategoryId: null, isActive: false },
  { id: 'd4', categoryId: 'plastik', subcategoryId: 'burun', isActive: true },
  { id: 'd5', categoryId: 'plastik', subcategoryId: 'meme', isActive: true },
]

describe('resolveAssignees', () => {
  it('alt kırılımsız kategoride tüm aktif doktorlar', () => {
    expect(resolveAssignees({ categoryId: 'sac', subcategoryId: null }, docs).sort())
      .toEqual(['d1', 'd2'])
  })
  it('pasif doktor atanmaz', () => {
    expect(resolveAssignees({ categoryId: 'sac', subcategoryId: null }, docs))
      .not.toContain('d3')
  })
  it('alt kırılımlı kategoride yalnız o alt kırılımın doktorları', () => {
    expect(resolveAssignees({ categoryId: 'plastik', subcategoryId: 'burun' }, docs))
      .toEqual(['d4'])
  })
  it('eşleşme yoksa boş liste', () => {
    expect(resolveAssignees({ categoryId: 'dis', subcategoryId: null }, docs))
      .toEqual([])
  })
})
```

- [ ] **Step 2: Testi çalıştır, fail görsün**

Run: `npx vitest run src/domain/__tests__/assignment.test.ts`
Expected: FAIL ("Cannot find module '../assignment'")

- [ ] **Step 3: Implementasyonu yaz**

`src/domain/assignment.ts`:
```ts
export interface AssignableDoctor {
  id: string
  categoryId: string
  subcategoryId: string | null
  isActive: boolean
}
export interface AssignmentTarget {
  categoryId: string
  subcategoryId: string | null
}

export function resolveAssignees(
  target: AssignmentTarget,
  doctors: AssignableDoctor[],
): string[] {
  return doctors
    .filter((d) => d.isActive && d.categoryId === target.categoryId)
    .filter((d) => (target.subcategoryId == null ? true : d.subcategoryId === target.subcategoryId))
    .map((d) => d.id)
}
```

- [ ] **Step 4: Testi çalıştır, pass görsün**

Run: `npx vitest run src/domain/__tests__/assignment.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add src/domain/assignment.ts src/domain/__tests__/assignment.test.ts
git commit -m "feat: eşzamanlı atama çözümü (resolveAssignees) + testleri

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Domain — karar toplama (`decision.ts`)

**Files:**
- Create: `src/domain/decision.ts`, `src/domain/__tests__/decision.test.ts`

**Interfaces:**
- Consumes: `Decision`, `RequestStatus` (domain.ts)
- Produces:
  - `interface DoctorResponse { doctorId: string; decision: Decision }`
  - `function aggregateStatus(assignedDoctorIds: string[], responses: DoctorResponse[]): 'in_review' | 'offers_ready' | 'escalated'`
    - En az bir `accept` → `offers_ready`
    - Yoksa ve **atanan tüm doktorlar** red verdiyse → `escalated`
    - Aksi halde (bazıları henüz yanıtlamadı, kabul yok) → `in_review`

- [ ] **Step 1: Failing test yaz**

`src/domain/__tests__/decision.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { aggregateStatus, type DoctorResponse } from '../decision'

const assigned = ['d1', 'd2', 'd3']

describe('aggregateStatus', () => {
  it('en az bir kabul -> offers_ready', () => {
    const r: DoctorResponse[] = [{ doctorId: 'd1', decision: 'accept' }]
    expect(aggregateStatus(assigned, r)).toBe('offers_ready')
  })
  it('çoklu bağımsız kabul -> offers_ready', () => {
    const r: DoctorResponse[] = [
      { doctorId: 'd1', decision: 'accept' },
      { doctorId: 'd2', decision: 'accept' },
    ]
    expect(aggregateStatus(assigned, r)).toBe('offers_ready')
  })
  it('tüm atananlar red -> escalated', () => {
    const r: DoctorResponse[] = [
      { doctorId: 'd1', decision: 'reject' },
      { doctorId: 'd2', decision: 'reject' },
      { doctorId: 'd3', decision: 'reject' },
    ]
    expect(aggregateStatus(assigned, r)).toBe('escalated')
  })
  it('kısmi red, kabul yok, bekleyen var -> in_review', () => {
    const r: DoctorResponse[] = [{ doctorId: 'd1', decision: 'reject' }]
    expect(aggregateStatus(assigned, r)).toBe('in_review')
  })
  it('hiç yanıt yok -> in_review', () => {
    expect(aggregateStatus(assigned, [])).toBe('in_review')
  })
})
```

- [ ] **Step 2: Testi çalıştır, fail görsün**

Run: `npx vitest run src/domain/__tests__/decision.test.ts`
Expected: FAIL ("Cannot find module '../decision'")

- [ ] **Step 3: Implementasyonu yaz**

`src/domain/decision.ts`:
```ts
import type { Decision } from '../types/domain'

export interface DoctorResponse {
  doctorId: string
  decision: Decision
}

export function aggregateStatus(
  assignedDoctorIds: string[],
  responses: DoctorResponse[],
): 'in_review' | 'offers_ready' | 'escalated' {
  const hasAccept = responses.some((r) => r.decision === 'accept')
  if (hasAccept) return 'offers_ready'
  const rejectedIds = new Set(responses.filter((r) => r.decision === 'reject').map((r) => r.doctorId))
  const allRejected = assignedDoctorIds.length > 0 && assignedDoctorIds.every((id) => rejectedIds.has(id))
  return allRejected ? 'escalated' : 'in_review'
}
```

- [ ] **Step 4: Testi çalıştır, pass görsün**

Run: `npx vitest run src/domain/__tests__/decision.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add src/domain/decision.ts src/domain/__tests__/decision.test.ts
git commit -m "feat: çoklu bağımsız yanıt toplama (aggregateStatus) + testleri

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Supabase projesi + şema migration'ları

> **NOT (execution gate):** Bu task Supabase Cloud'da proje oluşturur/kullanır. Uygulayan kişi, `medtriage` için **yeni proje mi açılacak yoksa mevcut proje mi kullanılacak** kararını kullanıcıya sormadan devam ETMEZ (org'da zaten 2 aktif proje var, üçüncü aktif proje kota/plan gerektirebilir). Karar alındıktan sonra project ref öğrenilir ve migration'lar uygulanır.

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls.sql`

**Interfaces:**
- Produces: tenant-scoped tablolar (spec §5), enum tipleri, `current_tenant_id()` fonksiyonu, RLS politikaları.

- [ ] **Step 1: Şema migration'ını yaz** — `supabase/migrations/0001_schema.sql`

```sql
-- Enums
create type user_role as enum ('agent','sales','doctor','coordinator','admin');
create type request_status as enum ('draft','submitted','assigned','in_review','offers_ready','escalated','closed');
create type sale_status as enum ('not_completed','sale_done','operation_done');
create type assignment_type as enum ('simultaneous','manual');
create type decision_type as enum ('accept','reject');
create type photo_layer as enum ('active','archive');

create table tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table app_user (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenant(id),
  role user_role not null,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table category (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  name text not null,
  has_subcategories boolean not null default false,
  assignment_mode text not null default 'simultaneous'
);

create table subcategory (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references category(id) on delete cascade,
  name text not null
);

create table operation_type (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references category(id) on delete cascade,
  subcategory_id uuid references subcategory(id) on delete cascade,
  name text not null
);

create table doctor (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  app_user_id uuid references app_user(id),
  photo_url text,
  title text,
  specialty text,
  category_id uuid not null references category(id),
  subcategory_id uuid references subcategory(id),
  bio text,
  weighted_work jsonb not null default '[]',
  score int not null default 100,
  is_active boolean not null default true
);

create table patient (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table request (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  patient_id uuid not null references patient(id),
  created_by uuid not null references app_user(id),
  category_id uuid not null references category(id),
  subcategory_id uuid references subcategory(id),
  operation_type_id uuid references operation_type(id),
  notes text,
  status request_status not null default 'draft',
  sale_status sale_status not null default 'not_completed',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  assigned_at timestamptz
);

create table photo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  layer photo_layer not null default 'active'
);

create table assignment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  doctor_id uuid not null references doctor(id),
  type assignment_type not null default 'simultaneous',
  assigned_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (request_id, doctor_id)
);

create table response (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  request_id uuid not null references request(id) on delete cascade,
  doctor_id uuid not null references doctor(id),
  decision decision_type not null,
  reject_reason text,
  treatment_plan text,
  responded_at timestamptz not null default now(),
  unique (request_id, doctor_id),
  check (decision = 'accept' or reject_reason is not null)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  actor_id uuid references app_user(id),
  action text not null,
  entity text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index on request (tenant_id, status);
create index on assignment (doctor_id, seen_at);
create index on response (request_id);
create index on doctor (tenant_id, category_id, subcategory_id);
```

- [ ] **Step 2: RLS migration'ını yaz** — `supabase/migrations/0002_rls.sql`

```sql
-- Helper: aktif kullanıcının tenant'ı
create or replace function current_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from app_user where id = auth.uid()
$$;

create or replace function current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from app_user where id = auth.uid()
$$;

-- Aktif kullanıcının doctor id'si (doktor rolü için)
create or replace function current_doctor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from doctor where app_user_id = auth.uid()
$$;

alter table tenant enable row level security;
alter table app_user enable row level security;
alter table category enable row level security;
alter table subcategory enable row level security;
alter table operation_type enable row level security;
alter table doctor enable row level security;
alter table patient enable row level security;
alter table request enable row level security;
alter table photo enable row level security;
alter table assignment enable row level security;
alter table response enable row level security;
alter table audit_log enable row level security;

-- Tenant içi genel okuma (katalog + kendi tenant satırları)
create policy tenant_read_category on category for select using (tenant_id = current_tenant_id());
create policy tenant_read_subcategory on subcategory for select
  using (category_id in (select id from category where tenant_id = current_tenant_id()));
create policy tenant_read_operation on operation_type for select
  using (category_id in (select id from category where tenant_id = current_tenant_id()));
create policy tenant_read_doctor on doctor for select using (tenant_id = current_tenant_id());
create policy tenant_read_appuser on app_user for select using (tenant_id = current_tenant_id());
create policy tenant_read_patient on patient for select using (tenant_id = current_tenant_id());

-- coordinator/admin tam yetki (her tabloda)
-- request
create policy req_admin_all on request for all
  using (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'))
  with check (tenant_id = current_tenant_id());
-- satışçı/aracı: kendi oluşturduğu talepler
create policy req_creator_rw on request for all
  using (tenant_id = current_tenant_id() and created_by = auth.uid() and current_role_name() in ('agent','sales'))
  with check (tenant_id = current_tenant_id() and created_by = auth.uid());
-- doktor: yalnız kendisine atanan talepleri görür
create policy req_doctor_read on request for select
  using (tenant_id = current_tenant_id()
    and id in (select request_id from assignment where doctor_id = current_doctor_id()));

-- patient: agent/sales insert + tenant okuma; admin all
create policy patient_write on patient for insert
  with check (tenant_id = current_tenant_id() and current_role_name() in ('agent','sales','coordinator','admin'));
create policy patient_admin_all on patient for all
  using (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'))
  with check (tenant_id = current_tenant_id());

-- photo: talebi görebilen görebilir; agent kendi talebininkini yükler
create policy photo_read on photo for select
  using (tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator','admin')
    or request_id in (select id from request where created_by = auth.uid())
    or request_id in (select request_id from assignment where doctor_id = current_doctor_id())
  ));
create policy photo_write on photo for insert
  with check (tenant_id = current_tenant_id()
    and request_id in (select id from request where created_by = auth.uid()));

-- assignment: doktor kendi satırını görür/günceller (seen_at); admin all
create policy asg_doctor_rw on assignment for all
  using (tenant_id = current_tenant_id() and (
    current_role_name() in ('coordinator','admin') or doctor_id = current_doctor_id()))
  with check (tenant_id = current_tenant_id());

-- response: KRİTİK izin sınırı (FR-21)
--  - doctor: yalnız kendi response'unu yazar/görür
--  - sales/coordinator/admin: tenant içindeki tüm response'ları görür (planları sunar)
--  - agent: response'a HİÇ erişemez (politika yok => görünmez)
create policy resp_doctor_write on response for insert
  with check (tenant_id = current_tenant_id() and doctor_id = current_doctor_id());
create policy resp_doctor_read on response for select
  using (tenant_id = current_tenant_id() and doctor_id = current_doctor_id());
create policy resp_sales_admin_read on response for select
  using (tenant_id = current_tenant_id() and current_role_name() in ('sales','coordinator','admin'));

-- audit_log: admin okur; herkes kendi aksiyonunu yazar
create policy audit_write on audit_log for insert with check (tenant_id = current_tenant_id());
create policy audit_admin_read on audit_log for select
  using (tenant_id = current_tenant_id() and current_role_name() in ('coordinator','admin'));
```

- [ ] **Step 3: Migration'ları Supabase'e uygula**

Supabase MCP `apply_migration` ile (project_ref belirlendikten sonra):
```
apply_migration(project_id=<ref>, name="0001_schema", query=<0001_schema.sql içeriği>)
apply_migration(project_id=<ref>, name="0002_rls", query=<0002_rls.sql içeriği>)
```

- [ ] **Step 4: Doğrula**

`list_tables(project_id=<ref>, schemas=["public"])` çağır; 12 tablonun (tenant, app_user, category, subcategory, operation_type, doctor, patient, request, photo, assignment, response, audit_log) listelendiğini gör.
`get_advisors(project_id=<ref>, type="security")` çağır; RLS'siz tablo uyarısı OLMADIĞINI doğrula.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat: Supabase şema + RLS migration'ları (12 tablo, tenant izolasyonu, FR-21 izin sınırı)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Seed verisi + Storage bucket

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Produces: Rememore tenant, 7 kategori + Plastik/Obezite alt kırılımları, örnek operasyon tipleri, `photos` storage bucket.
- Not: `app_user` satırları `auth.users` gerektirir; kullanıcılar Supabase Auth'ta oluşturulunca (Task 7 execution) UUID'leri seed'e girilir veya Auth admin API ile oluşturulur.

- [ ] **Step 1: Katalog seed'ini yaz** — `supabase/seed.sql`

```sql
-- Tenant
insert into tenant (id, name) values ('00000000-0000-0000-0000-000000000001', 'Rememore')
  on conflict do nothing;

-- Kategoriler (7 ana)
insert into category (id, tenant_id, name, has_subcategories) values
 ('c1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Saç Ekimi', false),
 ('c1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Plastik Cerrahi', true),
 ('c1000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Obezite Cerrahisi', true),
 ('c1000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Diş Tedavisi', false),
 ('c1000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','Boy Uzatma', false),
 ('c1000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','Penis Estetiği', false),
 ('c1000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','Genital Estetik', false)
 on conflict do nothing;

-- Plastik Cerrahi alt kırılımları
insert into subcategory (id, category_id, name) values
 ('5c000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002','Yüz estetiği'),
 ('5c000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','Vücut estetiği'),
 ('5c000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000002','Meme estetiği'),
 ('5c000000-0000-0000-0000-000000000004','c1000000-0000-0000-0000-000000000002','Burun estetiği'),
 ('5c000000-0000-0000-0000-000000000005','c1000000-0000-0000-0000-000000000003','Gastric Sleeve'),
 ('5c000000-0000-0000-0000-000000000006','c1000000-0000-0000-0000-000000000003','Revizyon Cerrahisi'),
 ('5c000000-0000-0000-0000-000000000007','c1000000-0000-0000-0000-000000000003','ESG & POSE')
 on conflict do nothing;

-- Örnek operasyon tipleri
insert into operation_type (category_id, subcategory_id, name) values
 ('c1000000-0000-0000-0000-000000000002','5c000000-0000-0000-0000-000000000002','360 Lipo'),
 ('c1000000-0000-0000-0000-000000000002','5c000000-0000-0000-0000-000000000002','Karın Germe'),
 ('c1000000-0000-0000-0000-000000000002','5c000000-0000-0000-0000-000000000004','Rinoplasti'),
 ('c1000000-0000-0000-0000-000000000001',null,'FUE Saç Ekimi'),
 ('c1000000-0000-0000-0000-000000000003','5c000000-0000-0000-0000-000000000005','Tüp Mide');
```

- [ ] **Step 2: Seed'i uygula ve Storage bucket'ı oluştur**

`execute_sql(project_id=<ref>, query=<seed.sql>)`.
Storage `photos` bucket'ı (private) Supabase dashboard veya SQL ile oluşturulur:
```sql
insert into storage.buckets (id, name, public) values ('photos','photos', false)
  on conflict do nothing;
```

- [ ] **Step 3: Doğrula**

`execute_sql(project_id=<ref>, query="select name from category order by name")` → 7 kategori.
`execute_sql(project_id=<ref>, query="select count(*) from subcategory")` → 7.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: Rememore seed verisi (7 kategori, alt kırılımlar, operasyon tipleri) + photos bucket

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Supabase client + Auth + rol bağlamı + kullanıcı seed

**Files:**
- Create: `.env.local`, `src/lib/supabase.ts`, `src/lib/auth.tsx`, `src/lib/queryClient.ts`, `src/types/db.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Role` (domain.ts)
- Produces:
  - `supabase` (SupabaseClient)
  - `useAuth(): { session, appUser, role, loading, signIn(email,pw), signOut() }`
  - `AuthProvider`

- [ ] **Step 1: Ortam değişkenleri** — `.env.local` (git'e girmez)

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```
(`get_project_url` ve `get_publishable_keys` MCP çağrılarıyla alınır.)

- [ ] **Step 2: Supabase client** — `src/lib/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
})
```

- [ ] **Step 3: DB tipleri** — `src/types/db.ts`

```ts
import type { Role, RequestStatus, SaleStatus, Decision } from './domain'

export interface AppUserRow { id: string; tenant_id: string; role: Role; full_name: string; phone: string | null; is_active: boolean }
export interface CategoryRow { id: string; tenant_id: string; name: string; has_subcategories: boolean }
export interface SubcategoryRow { id: string; category_id: string; name: string }
export interface OperationTypeRow { id: string; category_id: string; subcategory_id: string | null; name: string }
export interface DoctorRow { id: string; tenant_id: string; app_user_id: string | null; photo_url: string | null; title: string | null; specialty: string | null; category_id: string; subcategory_id: string | null; bio: string | null; weighted_work: unknown; score: number; is_active: boolean }
export interface PatientRow { id: string; tenant_id: string; first_name: string; last_name: string; phone: string | null; email: string | null }
export interface RequestRow { id: string; tenant_id: string; patient_id: string; created_by: string; category_id: string; subcategory_id: string | null; operation_type_id: string | null; notes: string | null; status: RequestStatus; sale_status: SaleStatus; created_at: string; submitted_at: string | null; assigned_at: string | null }
export interface PhotoRow { id: string; request_id: string; storage_path: string; uploaded_at: string; layer: 'active' | 'archive' }
export interface AssignmentRow { id: string; request_id: string; doctor_id: string; type: 'simultaneous' | 'manual'; assigned_at: string; seen_at: string | null }
export interface ResponseRow { id: string; request_id: string; doctor_id: string; decision: Decision; reject_reason: string | null; treatment_plan: string | null; responded_at: string }
```

- [ ] **Step 4: Auth provider** — `src/lib/auth.tsx`

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { AppUserRow } from '../types/db'
import type { Role } from '../types/domain'

interface AuthValue {
  session: Session | null
  appUser: AppUserRow | null
  role: Role | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}
const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [appUser, setAppUser] = useState<AppUserRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setAppUser(null); setLoading(false); return }
    supabase.from('app_user').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setAppUser(data as AppUserRow | null); setLoading(false) })
  }, [session])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }
  const signOut = async () => { await supabase.auth.signOut() }

  return <Ctx.Provider value={{ session, appUser, role: appUser?.role ?? null, loading, signIn, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth AuthProvider içinde kullanılmalı')
  return v
}
```

- [ ] **Step 5: queryClient + App'i sarmalama** — `src/lib/queryClient.ts`

```ts
import { QueryClient } from '@tanstack/react-query'
export const queryClient = new QueryClient()
```

`src/App.tsx` (router iskeleti — rotalar sonraki task'larda dolacak):
```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { queryClient } from './lib/queryClient'
import { AuthProvider, useAuth } from './lib/auth'
import { LoginPage } from './features/auth/LoginPage'

function Home() {
  const { role } = useAuth()
  return <div className="p-4">Giriş yapıldı. Rol: {role}</div>
}

function Protected({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-4">Yükleniyor…</div>
  return session ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Protected><Home /></Protected>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 6: Test kullanıcıları oluştur (execution)**

Her rol için Supabase Auth kullanıcısı oluştur (dashboard Auth veya admin API), sonra `app_user` satırlarını ekle:
```sql
-- <uid_*> değerlerini oluşturulan auth kullanıcı id'leriyle değiştir
insert into app_user (id, tenant_id, role, full_name) values
 ('<uid_sales>','00000000-0000-0000-0000-000000000001','sales','Satış Kullanıcı'),
 ('<uid_agent>','00000000-0000-0000-0000-000000000001','agent','Aracı Kullanıcı'),
 ('<uid_doc1>','00000000-0000-0000-0000-000000000001','doctor','Dr. Ayşe'),
 ('<uid_doc2>','00000000-0000-0000-0000-000000000001','doctor','Dr. Mehmet'),
 ('<uid_coord>','00000000-0000-0000-0000-000000000001','coordinator','Koordinatör');
-- doktor profilleri (Saç Ekimi kategorisine)
insert into doctor (tenant_id, app_user_id, title, specialty, category_id) values
 ('00000000-0000-0000-0000-000000000001','<uid_doc1>','Op. Dr.','Saç Ekimi','c1000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000001','<uid_doc2>','Op. Dr.','Saç Ekimi','c1000000-0000-0000-0000-000000000001');
```

- [ ] **Step 7: Doğrula**

Run: `npm run dev`, `/login` olmadan `/` → login'e yönlenir. (Login UI Task 8'de.)
Run: `npm run build` → hatasız.

- [ ] **Step 8: Commit**

```bash
git add src/lib src/types/db.ts src/App.tsx .gitignore
git commit -m "feat: Supabase client, davet-bazlı auth + rol bağlamı, router iskeleti

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Login ekranı + korumalı yönlendirme

**Files:**
- Create: `src/features/auth/LoginPage.tsx`, `src/components/Layout.tsx`, `src/components/RoleGate.tsx`

**Interfaces:**
- Consumes: `useAuth`
- Produces: `LoginPage`, `Layout` (üst bar + çıkış), `RoleGate({ allow, children })` (rol bazlı gösterim)

- [ ] **Step 1: LoginPage** — `src/features/auth/LoginPage.tsx`

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export function LoginPage() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await signIn(email, pw)
    if (error) setErr('Giriş başarısız: ' + error)
    else nav('/')
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 bg-white p-6 rounded-xl shadow">
        <h1 className="text-xl font-semibold">MedTriage</h1>
        <input className="w-full border rounded p-2" placeholder="E-posta" value={email}
          onChange={(e) => setEmail(e.target.value)} type="email" />
        <input className="w-full border rounded p-2" placeholder="Şifre" value={pw}
          onChange={(e) => setPw(e.target.value)} type="password" />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="w-full bg-slate-800 text-white rounded p-2">Giriş</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: RoleGate + Layout** — `src/components/RoleGate.tsx`

```tsx
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import type { Role } from '../types/domain'

export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role } = useAuth()
  if (!role || !allow.includes(role)) return null
  return <>{children}</>
}
```

`src/components/Layout.tsx`:
```tsx
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'

export function Layout({ children }: { children: ReactNode }) {
  const { appUser, signOut } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
        <span className="font-semibold">MedTriage</span>
        <span className="text-sm">{appUser?.full_name} · <button onClick={signOut} className="underline">Çıkış</button></span>
      </header>
      <main className="max-w-3xl mx-auto p-4">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Doğrula (manuel)**

Run: `npm run dev`. Seed kullanıcısıyla giriş yap → `/` "Rol: sales" gösterir. Çıkış → login.

- [ ] **Step 4: Commit**

```bash
git add src/features/auth src/components
git commit -m "feat: login ekranı, Layout ve RoleGate bileşenleri

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Katalog + talep girişi wizard + fotoğraf yükleme

**Files:**
- Create: `src/features/catalog/useCatalog.ts`, `src/features/requests/usePhotoUpload.ts`, `src/features/requests/useRequests.ts`, `src/features/requests/NewRequestWizard.tsx`, `src/components/PhotoUploader.tsx`
- Modify: `src/App.tsx` (rota ekle)

**Interfaces:**
- Consumes: `supabase`, `useAuth`, DB tipleri
- Produces:
  - `useCategories()`, `useSubcategories(categoryId)`, `useOperationTypes(categoryId, subcategoryId)`
  - `useCreateRequest()` → hasta + talep insert + fotoğraf yükleme + submit (`status='submitted'`)
  - `NewRequestWizard`

- [ ] **Step 1: Katalog hook'ları** — `src/features/catalog/useCatalog.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { CategoryRow, SubcategoryRow, OperationTypeRow } from '../../types/db'

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: async () => {
    const { data, error } = await supabase.from('category').select('*').order('name')
    if (error) throw error
    return data as CategoryRow[]
  }})
}
export function useSubcategories(categoryId?: string) {
  return useQuery({ queryKey: ['subcategories', categoryId], enabled: !!categoryId, queryFn: async () => {
    const { data, error } = await supabase.from('subcategory').select('*').eq('category_id', categoryId!).order('name')
    if (error) throw error
    return data as SubcategoryRow[]
  }})
}
export function useOperationTypes(categoryId?: string, subcategoryId?: string | null) {
  return useQuery({ queryKey: ['ops', categoryId, subcategoryId], enabled: !!categoryId, queryFn: async () => {
    let q = supabase.from('operation_type').select('*').eq('category_id', categoryId!)
    if (subcategoryId) q = q.eq('subcategory_id', subcategoryId)
    const { data, error } = await q.order('name')
    if (error) throw error
    return data as OperationTypeRow[]
  }})
}
```

- [ ] **Step 2: Fotoğraf yükleme + talep oluşturma** — `src/features/requests/usePhotoUpload.ts` ve `useRequests.ts`

`usePhotoUpload.ts`:
```ts
import { supabase } from '../../lib/supabase'

export async function uploadPhotos(tenantId: string, requestId: string, files: File[]) {
  for (const file of files) {
    const path = `${tenantId}/${requestId}/${crypto.randomUUID()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file)
    if (upErr) throw upErr
    const { error: insErr } = await supabase.from('photo').insert({
      tenant_id: tenantId, request_id: requestId, storage_path: path,
    })
    if (insErr) throw insErr
  }
}
```

`useRequests.ts` (create + assignment tetikleme):
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadPhotos } from './usePhotoUpload'
import { resolveAssignees } from '../../domain/assignment'
import type { DoctorRow } from '../../types/db'

interface NewRequestInput {
  tenantId: string
  createdBy: string
  patient: { first_name: string; last_name: string; phone?: string; age?: number }
  categoryId: string
  subcategoryId: string | null
  operationTypeId: string | null
  notes?: string
  files: File[]
}

export function useCreateRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewRequestInput) => {
      // 1) hasta
      const { data: patient, error: pErr } = await supabase.from('patient')
        .insert({ tenant_id: input.tenantId, first_name: input.patient.first_name, last_name: input.patient.last_name, phone: input.patient.phone })
        .select().single()
      if (pErr) throw pErr
      // 2) talep (submitted)
      const { data: req, error: rErr } = await supabase.from('request').insert({
        tenant_id: input.tenantId, patient_id: patient.id, created_by: input.createdBy,
        category_id: input.categoryId, subcategory_id: input.subcategoryId,
        operation_type_id: input.operationTypeId, notes: input.notes,
        status: 'submitted', submitted_at: new Date().toISOString(),
      }).select().single()
      if (rErr) throw rErr
      // 3) fotoğraflar
      if (input.files.length) await uploadPhotos(input.tenantId, req.id, input.files)
      // 4) eşzamanlı atama
      const { data: docs } = await supabase.from('doctor').select('*').eq('category_id', input.categoryId)
      const targets = resolveAssignees(
        { categoryId: input.categoryId, subcategoryId: input.subcategoryId },
        (docs as DoctorRow[] ?? []).map((d) => ({ id: d.id, categoryId: d.category_id, subcategoryId: d.subcategory_id, isActive: d.is_active })),
      )
      if (targets.length) {
        await supabase.from('assignment').insert(
          targets.map((doctor_id) => ({ tenant_id: input.tenantId, request_id: req.id, doctor_id, type: 'simultaneous' })))
        await supabase.from('request').update({ status: 'assigned', assigned_at: new Date().toISOString() }).eq('id', req.id)
      }
      return req.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}
```

- [ ] **Step 3: PhotoUploader bileşeni** — `src/components/PhotoUploader.tsx`

```tsx
export function PhotoUploader({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  return (
    <div>
      <input type="file" accept="image/*" multiple
        onChange={(e) => onChange(Array.from(e.target.files ?? []))} />
      <p className="text-sm text-slate-500">{files.length} fotoğraf seçili</p>
    </div>
  )
}
```

- [ ] **Step 4: Wizard** — `src/features/requests/NewRequestWizard.tsx`

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useCategories, useSubcategories, useOperationTypes } from '../catalog/useCatalog'
import { useCreateRequest } from './useRequests'
import { PhotoUploader } from '../../components/PhotoUploader'

export function NewRequestWizard() {
  const { appUser } = useAuth()
  const nav = useNavigate()
  const cats = useCategories()
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null)
  const [operationTypeId, setOperationTypeId] = useState<string | null>(null)
  const [first, setFirst] = useState(''); const [last, setLast] = useState('')
  const [notes, setNotes] = useState(''); const [files, setFiles] = useState<File[]>([])
  const subs = useSubcategories(categoryId)
  const ops = useOperationTypes(categoryId, subcategoryId)
  const create = useCreateRequest()

  const selectedCat = cats.data?.find((c) => c.id === categoryId)
  const needsSub = selectedCat?.has_subcategories
  const canSubmit = first && last && categoryId && (!needsSub || subcategoryId) && files.length > 0

  const submit = async () => {
    await create.mutateAsync({
      tenantId: appUser!.tenant_id, createdBy: appUser!.id,
      patient: { first_name: first, last_name: last },
      categoryId, subcategoryId: needsSub ? subcategoryId : null,
      operationTypeId, notes, files,
    })
    nav('/requests')
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Yeni Talep</h2>
      <input className="w-full border rounded p-2" placeholder="Ad" value={first} onChange={(e) => setFirst(e.target.value)} />
      <input className="w-full border rounded p-2" placeholder="Soyad" value={last} onChange={(e) => setLast(e.target.value)} />
      <select className="w-full border rounded p-2" value={categoryId}
        onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(null); setOperationTypeId(null) }}>
        <option value="">Kategori seç…</option>
        {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {needsSub && (
        <select className="w-full border rounded p-2" value={subcategoryId ?? ''}
          onChange={(e) => setSubcategoryId(e.target.value || null)}>
          <option value="">Alt kırılım seç… (zorunlu)</option>
          {subs.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {categoryId && (
        <select className="w-full border rounded p-2" value={operationTypeId ?? ''}
          onChange={(e) => setOperationTypeId(e.target.value || null)}>
          <option value="">Operasyon tipi (opsiyonel)…</option>
          {ops.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      <textarea className="w-full border rounded p-2" placeholder="Not" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <PhotoUploader files={files} onChange={setFiles} />
      <button disabled={!canSubmit || create.isPending}
        className="w-full bg-slate-800 text-white rounded p-2 disabled:opacity-40"
        onClick={submit}>{create.isPending ? 'Gönderiliyor…' : 'Gönder'}</button>
    </div>
  )
}
```

- [ ] **Step 5: Rota ekle** — `src/App.tsx` Routes içine

```tsx
<Route path="/requests/new" element={<Protected><Layout><RoleGate allow={['agent','sales']}><NewRequestWizard /></RoleGate></Layout></Protected>} />
```
(İlgili importları ekle: `Layout`, `RoleGate`, `NewRequestWizard`.)

- [ ] **Step 6: Doğrula (manuel)**

Run: `npm run dev`. Sales ile giriş → `/requests/new` → talep gir + foto seç → Gönder. Supabase'de `request.status='assigned'`, `assignment` satırları, `photo` kaydı oluştuğunu `execute_sql` ile doğrula.

- [ ] **Step 7: Commit**

```bash
git add src/features/catalog src/features/requests src/components/PhotoUploader.tsx src/App.tsx
git commit -m "feat: katalog hook'ları, talep girişi wizard, foto yükleme ve eşzamanlı atama

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Doktor kuyruğu + realtime bekleyen sayaç + talep görüntüleme

**Files:**
- Create: `src/features/doctor/usePendingCount.ts`, `src/features/doctor/DoctorQueue.tsx`, `src/features/doctor/DoctorRequestView.tsx`, `src/components/Badge.tsx`, `src/components/StatusPill.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase`, `useAuth`, DB tipleri
- Produces: `usePendingCount()` (realtime), `DoctorQueue`, `DoctorRequestView`

- [ ] **Step 1: Realtime bekleyen sayaç** — `src/features/doctor/usePendingCount.ts`

```ts
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Doktorun görmediği (seen_at IS NULL) atama sayısı; realtime güncellenir.
export function usePendingCount(doctorId?: string) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!doctorId) return
    const load = async () => {
      const { count: c } = await supabase.from('assignment')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctorId).is('seen_at', null)
      setCount(c ?? 0)
    }
    load()
    const ch = supabase.channel('pending-' + doctorId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment', filter: `doctor_id=eq.${doctorId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [doctorId])
  return count
}
```

- [ ] **Step 2: Badge + StatusPill** — `src/components/Badge.tsx`

```tsx
export function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-bold text-white bg-red-600 rounded-full">{count}</span>
}
```

`src/components/StatusPill.tsx`:
```tsx
import type { RequestStatus } from '../types/domain'
const LABEL: Record<RequestStatus, string> = {
  draft: 'Taslak', submitted: 'Gönderildi', assigned: 'Atandı', in_review: 'Yanıtlanıyor',
  offers_ready: 'Teklif hazır', escalated: 'Eskalasyon', closed: 'Kapandı',
}
export function StatusPill({ status }: { status: RequestStatus }) {
  return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200">{LABEL[status]}</span>
}
```

- [ ] **Step 3: Doktor id'sini çöz + kuyruk** — `src/features/doctor/DoctorQueue.tsx`

```tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePendingCount } from './usePendingCount'
import { Badge } from '../../components/Badge'
import { StatusPill } from '../../components/StatusPill'
import type { RequestRow } from '../../types/db'

function useMyDoctorId() {
  const { appUser } = useAuth()
  return useQuery({ queryKey: ['my-doctor', appUser?.id], enabled: !!appUser, queryFn: async () => {
    const { data } = await supabase.from('doctor').select('id').eq('app_user_id', appUser!.id).single()
    return data?.id as string | undefined
  }})
}

export function DoctorQueue() {
  const doc = useMyDoctorId()
  const pending = usePendingCount(doc.data)
  const list = useQuery({ queryKey: ['doctor-queue', doc.data], enabled: !!doc.data, queryFn: async () => {
    const { data: asgs } = await supabase.from('assignment').select('request_id').eq('doctor_id', doc.data!)
    const ids = (asgs ?? []).map((a) => a.request_id)
    if (!ids.length) return []
    const { data } = await supabase.from('request').select('*').in('id', ids).order('assigned_at', { ascending: false })
    return data as RequestRow[]
  }})
  return (
    <div>
      <h2 className="text-lg font-semibold">Bekleyen Talepler <Badge count={pending} /></h2>
      <ul className="mt-3 space-y-2">
        {list.data?.map((r) => (
          <li key={r.id} className="border rounded p-3 bg-white flex justify-between items-center">
            <span>Talep #{r.id.slice(0, 8)}</span>
            <span className="flex items-center gap-2"><StatusPill status={r.status} />
              <Link className="text-blue-600 underline" to={`/doctor/request/${r.id}`}>Aç</Link></span>
          </li>
        ))}
        {list.data?.length === 0 && <li className="text-slate-500">Talep yok.</li>}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Talep görüntüleme (seen_at yaz)** — `src/features/doctor/DoctorRequestView.tsx` (yanıt aksiyonları Task 11'de eklenecek; bu adımda görüntüleme + seen)

```tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { RequestRow, PhotoRow } from '../../types/db'

export function DoctorRequestView() {
  const { id } = useParams()
  const { appUser } = useAuth()
  const q = useQuery({ queryKey: ['doctor-request', id], enabled: !!id, queryFn: async () => {
    const { data: req } = await supabase.from('request').select('*').eq('id', id!).single()
    const { data: photos } = await supabase.from('photo').select('*').eq('request_id', id!)
    const signed = await Promise.all(((photos ?? []) as PhotoRow[]).map(async (p) => {
      const { data } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 300)
      return data?.signedUrl
    }))
    return { req: req as RequestRow, photos: signed.filter(Boolean) as string[] }
  }})

  useEffect(() => {
    // seen_at yaz (görüldü)
    (async () => {
      const { data: doc } = await supabase.from('doctor').select('id').eq('app_user_id', appUser!.id).single()
      if (doc?.id && id) {
        await supabase.from('assignment').update({ seen_at: new Date().toISOString() })
          .eq('request_id', id).eq('doctor_id', doc.id).is('seen_at', null)
      }
    })()
  }, [id, appUser])

  if (!q.data) return <p>Yükleniyor…</p>
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Talep #{q.data.req.id.slice(0, 8)}</h2>
      <p className="text-sm text-slate-600">{q.data.req.notes}</p>
      <div className="grid grid-cols-2 gap-2">
        {q.data.photos.map((url, i) => <img key={i} src={url} className="rounded border" />)}
      </div>
      {/* Yanıt aksiyonları Task 11 */}
    </div>
  )
}
```

- [ ] **Step 5: Rotalar** — `src/App.tsx`

```tsx
<Route path="/doctor" element={<Protected><Layout><RoleGate allow={['doctor']}><DoctorQueue /></RoleGate></Layout></Protected>} />
<Route path="/doctor/request/:id" element={<Protected><Layout><RoleGate allow={['doctor']}><DoctorRequestView /></RoleGate></Layout></Protected>} />
```

- [ ] **Step 6: Doğrula (manuel)**

İki tarayıcı/oturum: sales talep girer; doctor oturumunda `/doctor` sayaç artar (realtime); talebi açınca sayaç düşer, `seen_at` yazılır. Supabase'de doğrula.

- [ ] **Step 7: Commit**

```bash
git add src/features/doctor src/components/Badge.tsx src/components/StatusPill.tsx src/App.tsx
git commit -m "feat: doktor kuyruğu, realtime bekleyen sayaç, talep görüntüleme + seen_at

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Doktor kabul/red + tedavi planı + eskalasyon

**Files:**
- Create: `src/features/doctor/useRespond.ts`
- Modify: `src/features/doctor/DoctorRequestView.tsx`

**Interfaces:**
- Consumes: `supabase`, `aggregateStatus`, `nextStatus`
- Produces: `useRespond()` → response insert + talep durumunu `aggregateStatus` ile güncelle (offers_ready / escalated / in_review)

- [ ] **Step 1: useRespond hook'u** — `src/features/doctor/useRespond.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { aggregateStatus } from '../../domain/decision'
import type { Decision } from '../../types/domain'

export function useRespond() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      tenantId: string; requestId: string; doctorId: string
      decision: Decision; rejectReason?: string; treatmentPlan?: string
    }) => {
      // 1) response yaz (doktor başına bir; unique)
      const { error } = await supabase.from('response').insert({
        tenant_id: input.tenantId, request_id: input.requestId, doctor_id: input.doctorId,
        decision: input.decision, reject_reason: input.rejectReason ?? null,
        treatment_plan: input.decision === 'accept' ? (input.treatmentPlan ?? null) : null,
      })
      if (error) throw error
      // 2) toplam durumu hesapla
      const { data: asgs } = await supabase.from('assignment').select('doctor_id').eq('request_id', input.requestId)
      const { data: resps } = await supabase.from('response').select('doctor_id, decision').eq('request_id', input.requestId)
      const status = aggregateStatus(
        (asgs ?? []).map((a) => a.doctor_id),
        (resps ?? []).map((r) => ({ doctorId: r.doctor_id, decision: r.decision as Decision })),
      )
      await supabase.from('request').update({ status }).eq('id', input.requestId)
      return status
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doctor-queue'] }); qc.invalidateQueries({ queryKey: ['requests'] }) },
  })
}
```

- [ ] **Step 2: DoctorRequestView'a kabul/red UI ekle**

`DoctorRequestView.tsx` içine (foto grid'inin altına), state + aksiyonlar:
```tsx
// importlara: import { useState } from 'react'; import { useRespond } from './useRespond'
// component gövdesine:
const respond = useRespond()
const [mode, setMode] = useState<'none' | 'accept' | 'reject'>('none')
const [plan, setPlan] = useState('')
const [reason, setReason] = useState('')

const doRespond = async () => {
  const { data: doc } = await supabase.from('doctor').select('id, tenant_id').eq('app_user_id', appUser!.id).single()
  if (!doc) return
  await respond.mutateAsync({
    tenantId: doc.tenant_id, requestId: q.data!.req.id, doctorId: doc.id,
    decision: mode === 'accept' ? 'accept' : 'reject',
    treatmentPlan: mode === 'accept' ? plan : undefined,
    rejectReason: mode === 'reject' ? reason : undefined,
  })
  setMode('none')
}
```
JSX (foto grid altına):
```tsx
{mode === 'none' && (
  <div className="flex gap-2">
    <button className="flex-1 bg-green-600 text-white rounded p-2" onClick={() => setMode('accept')}>Kabul</button>
    <button className="flex-1 bg-red-600 text-white rounded p-2" onClick={() => setMode('reject')}>Red</button>
  </div>
)}
{mode === 'accept' && (
  <div className="space-y-2">
    <textarea className="w-full border rounded p-2" placeholder="Tedavi planı" value={plan} onChange={(e) => setPlan(e.target.value)} />
    <button disabled={!plan || respond.isPending} className="w-full bg-green-600 text-white rounded p-2 disabled:opacity-40" onClick={doRespond}>Kabul et</button>
  </div>
)}
{mode === 'reject' && (
  <div className="space-y-2">
    <textarea className="w-full border rounded p-2" placeholder="Red gerekçesi (zorunlu)" value={reason} onChange={(e) => setReason(e.target.value)} />
    <button disabled={!reason || respond.isPending} className="w-full bg-red-600 text-white rounded p-2 disabled:opacity-40" onClick={doRespond}>Reddet</button>
  </div>
)}
```

- [ ] **Step 3: Doğrula (manuel)**

İki doktor oturumu: ikisi de aynı Saç Ekimi talebini **kabul** eder → talep `offers_ready`; ikisi de **red** ederse → `escalated`. Supabase'de `response` 2 satır, `request.status` beklendiği gibi.

- [ ] **Step 4: Commit**

```bash
git add src/features/doctor/useRespond.ts src/features/doctor/DoctorRequestView.tsx
git commit -m "feat: doktor kabul/red + tedavi planı, toplam durum (offers_ready/escalated)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Satışçı/aracı talep listesi + detay (izin sınırı)

**Files:**
- Create: `src/features/requests/RequestList.tsx`, `src/features/requests/RequestDetail.tsx`
- Modify: `src/App.tsx`, `src/features/requests/useRequests.ts` (liste + detay hook'ları)

**Interfaces:**
- Consumes: `supabase`, `useAuth`, DB tipleri
- Produces: `useMyRequests()`, `useRequestDetail(id)` (satışçı: response+plan görünür; RLS zaten aracıya engeller), `RequestList`, `RequestDetail`

- [ ] **Step 1: Liste + detay hook'ları** — `useRequests.ts` sonuna ekle

```ts
import { useQuery } from '@tanstack/react-query'
import type { RequestRow, ResponseRow } from '../../types/db'

export function useMyRequests() {
  return useQuery({ queryKey: ['requests'], queryFn: async () => {
    const { data, error } = await supabase.from('request').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data as RequestRow[]
  }})
}

export function useRequestDetail(id?: string) {
  return useQuery({ queryKey: ['request', id], enabled: !!id, queryFn: async () => {
    const { data: req } = await supabase.from('request').select('*').eq('id', id!).single()
    // response: RLS gereği agent'a boş döner; sales/coordinator/admin görür
    const { data: responses } = await supabase.from('response').select('*').eq('request_id', id!)
    return { req: req as RequestRow, responses: (responses ?? []) as ResponseRow[] }
  }})
}
```

- [ ] **Step 2: RequestList** — `src/features/requests/RequestList.tsx`

```tsx
import { Link } from 'react-router-dom'
import { useMyRequests } from './useRequests'
import { StatusPill } from '../../components/StatusPill'
import { RoleGate } from '../../components/RoleGate'

export function RequestList() {
  const q = useMyRequests()
  return (
    <div>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Talepler</h2>
        <RoleGate allow={['agent','sales']}>
          <Link to="/requests/new" className="bg-slate-800 text-white rounded px-3 py-1">Yeni Talep</Link>
        </RoleGate>
      </div>
      <ul className="mt-3 space-y-2">
        {q.data?.map((r) => (
          <li key={r.id} className="border rounded p-3 bg-white flex justify-between items-center">
            <Link to={`/requests/${r.id}`} className="text-blue-600 underline">Talep #{r.id.slice(0, 8)}</Link>
            <StatusPill status={r.status} />
          </li>
        ))}
        {q.data?.length === 0 && <li className="text-slate-500">Talep yok.</li>}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: RequestDetail (izin sınırı vurgusu)** — `src/features/requests/RequestDetail.tsx`

```tsx
import { useParams } from 'react-router-dom'
import { useRequestDetail } from './useRequests'
import { RoleGate } from '../../components/RoleGate'
import { StatusPill } from '../../components/StatusPill'

export function RequestDetail() {
  const { id } = useParams()
  const q = useRequestDetail(id)
  if (!q.data) return <p>Yükleniyor…</p>
  const { req, responses } = q.data
  const accepted = responses.filter((r) => r.decision === 'accept')
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Talep #{req.id.slice(0, 8)}</h2>
        <StatusPill status={req.status} />
      </div>
      {/* Doktor planları: yalnız sales/coordinator/admin. Aracıya RLS zaten engeller; UI de gizler. */}
      <RoleGate allow={['sales','coordinator','admin']}>
        <section>
          <h3 className="font-medium">Doktor Teklifleri ({accepted.length})</h3>
          {accepted.map((r) => (
            <div key={r.id} className="border rounded p-3 bg-white mt-2">
              <p className="text-sm text-slate-500">Doktor #{r.doctor_id.slice(0, 8)}</p>
              <p className="whitespace-pre-wrap">{r.treatment_plan}</p>
            </div>
          ))}
          {accepted.length === 0 && <p className="text-slate-500">Henüz kabul eden doktor yok.</p>}
        </section>
      </RoleGate>
      <RoleGate allow={['agent']}>
        <p className="text-slate-500 text-sm">Doktor yanıtı hazır olduğunda satış ekibi sizinle paylaşacaktır.</p>
      </RoleGate>
    </div>
  )
}
```

- [ ] **Step 4: Rotalar** — `src/App.tsx`

```tsx
<Route path="/requests" element={<Protected><Layout><RequestList /></Layout></Protected>} />
<Route path="/requests/:id" element={<Protected><Layout><RequestDetail /></Layout></Protected>} />
```
Ana `Home`'u role göre yönlendirecek şekilde güncelle: doctor → `/doctor`, diğerleri → `/requests`.

- [ ] **Step 5: Doğrula (manuel)**

Sales oturumu: `/requests/:id` → doktor planlarını görür. Agent oturumu: aynı talepte planları **görmez** (hem UI RoleGate hem RLS). Supabase'de agent token'ıyla `response` select'in boş döndüğünü doğrula.

- [ ] **Step 6: Commit**

```bash
git add src/features/requests/RequestList.tsx src/features/requests/RequestDetail.tsx src/features/requests/useRequests.ts src/App.tsx
git commit -m "feat: talep listesi + detay, doktor planı izin sınırı (agent göremez)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: Koordinatör — doktor tanımlama, havuz, tüm talepler, manuel yeniden atama

**Files:**
- Create: `src/features/admin/DoctorAdmin.tsx`, `src/features/admin/AllRequests.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase`, `useCategories`, `resolveAssignees`
- Produces: `DoctorAdmin` (doktor ekle/kategoriye ata/aktiflik), `AllRequests` (tüm talepler + manuel yeniden atama)

- [ ] **Step 1: DoctorAdmin** — `src/features/admin/DoctorAdmin.tsx`

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useCategories } from '../catalog/useCatalog'
import type { DoctorRow } from '../../types/db'

export function DoctorAdmin() {
  const { appUser } = useAuth()
  const qc = useQueryClient()
  const cats = useCategories()
  const [name, setName] = useState(''); const [categoryId, setCategoryId] = useState('')
  const docs = useQuery({ queryKey: ['doctors'], queryFn: async () => {
    const { data } = await supabase.from('doctor').select('*').order('title')
    return data as DoctorRow[]
  }})
  const addDoctor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('doctor').insert({
        tenant_id: appUser!.tenant_id, title: name, category_id: categoryId, is_active: true,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doctors'] }); setName(''); setCategoryId('') },
  })
  const toggle = useMutation({
    mutationFn: async (d: DoctorRow) => { await supabase.from('doctor').update({ is_active: !d.is_active }).eq('id', d.id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Doktor Yönetimi</h2>
      <div className="flex gap-2">
        <input className="border rounded p-2 flex-1" placeholder="Doktor adı" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="border rounded p-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Kategori…</option>
          {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button disabled={!name || !categoryId} className="bg-slate-800 text-white rounded px-3 disabled:opacity-40" onClick={() => addDoctor.mutate()}>Ekle</button>
      </div>
      <ul className="space-y-2">
        {docs.data?.map((d) => (
          <li key={d.id} className="border rounded p-3 bg-white flex justify-between">
            <span>{d.title} · skor {d.score} {d.is_active ? '' : '(pasif)'}</span>
            <button className="underline text-sm" onClick={() => toggle.mutate(d)}>{d.is_active ? 'Pasifleştir' : 'Aktifleştir'}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: AllRequests + manuel yeniden atama** — `src/features/admin/AllRequests.tsx`

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusPill } from '../../components/StatusPill'
import type { RequestRow, DoctorRow } from '../../types/db'

export function AllRequests() {
  const { appUser } = useAuth()
  const qc = useQueryClient()
  const reqs = useQuery({ queryKey: ['all-requests'], queryFn: async () => {
    const { data } = await supabase.from('request').select('*').order('created_at', { ascending: false })
    return data as RequestRow[]
  }})
  const reassign = useMutation({
    // Manuel: talebin kategorisindeki tüm doktorları yeniden ata (audit'li)
    mutationFn: async (req: RequestRow) => {
      const { data: docs } = await supabase.from('doctor').select('*').eq('category_id', req.category_id).eq('is_active', true)
      const rows = (docs as DoctorRow[] ?? []).map((d) => ({ tenant_id: req.tenant_id, request_id: req.id, doctor_id: d.id, type: 'manual' as const }))
      if (rows.length) await supabase.from('assignment').upsert(rows, { onConflict: 'request_id,doctor_id', ignoreDuplicates: true })
      await supabase.from('audit_log').insert({ tenant_id: req.tenant_id, actor_id: appUser!.id, action: 'reassign', entity: 'request', after: { request_id: req.id } })
      await supabase.from('request').update({ status: 'assigned' }).eq('id', req.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-requests'] }),
  })
  return (
    <div>
      <h2 className="text-lg font-semibold">Tüm Talepler</h2>
      <ul className="mt-3 space-y-2">
        {reqs.data?.map((r) => (
          <li key={r.id} className="border rounded p-3 bg-white flex justify-between items-center">
            <span>#{r.id.slice(0, 8)} <StatusPill status={r.status} /></span>
            <button className="underline text-sm" onClick={() => reassign.mutate(r)}>Yeniden ata</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Rotalar** — `src/App.tsx`

```tsx
<Route path="/admin/doctors" element={<Protected><Layout><RoleGate allow={['coordinator','admin']}><DoctorAdmin /></RoleGate></Layout></Protected>} />
<Route path="/admin/requests" element={<Protected><Layout><RoleGate allow={['coordinator','admin']}><AllRequests /></RoleGate></Layout></Protected>} />
```

- [ ] **Step 4: Doğrula (manuel)**

Coordinator oturumu: doktor ekle (Saç Ekimi) → yeni talep o doktora da düşer. `/admin/requests` → yeniden ata → `audit_log`'a satır yazıldığını doğrula.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin src/App.tsx
git commit -m "feat: koordinatör doktor yönetimi, tüm talepler, manuel yeniden atama (audit'li)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 14: Uçtan uca test (Playwright) — çekirdek akış + izin sınırı

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/core-flow.spec.ts`

**Interfaces:**
- Consumes: çalışan dev server + seed kullanıcılar (env'den e-posta/şifre).

- [ ] **Step 1: Playwright yapılandırması** — `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
})
```

- [ ] **Step 2: Çekirdek akış testi** — `tests/e2e/core-flow.spec.ts`

```ts
import { test, expect } from '@playwright/test'

// Seed kullanıcı kimlikleri env'den (E2E_SALES_EMAIL vb.)
const SALES = { email: process.env.E2E_SALES_EMAIL!, pw: process.env.E2E_SALES_PW! }
const DOCTOR = { email: process.env.E2E_DOCTOR_EMAIL!, pw: process.env.E2E_DOCTOR_PW! }
const AGENT = { email: process.env.E2E_AGENT_EMAIL!, pw: process.env.E2E_AGENT_PW! }

async function login(page, u: { email: string; pw: string }) {
  await page.goto('/login')
  await page.getByPlaceholder('E-posta').fill(u.email)
  await page.getByPlaceholder('Şifre').fill(u.pw)
  await page.getByRole('button', { name: 'Giriş' }).click()
  await expect(page).not.toHaveURL(/login/)
}

test('satışçı talep girer, doktor kabul eder, satışçı planı görür; aracı göremez', async ({ browser }) => {
  // 1) Satışçı talep girer
  const salesCtx = await browser.newContext(); const sales = await salesCtx.newPage()
  await login(sales, SALES)
  await sales.goto('/requests/new')
  await sales.getByPlaceholder('Ad').fill('Test'); await sales.getByPlaceholder('Soyad').fill('Hasta')
  await sales.getByRole('combobox').first().selectOption({ label: 'Saç Ekimi' })
  await sales.setInputFiles('input[type=file]', 'tests/e2e/fixtures/sample.jpg')
  await sales.getByRole('button', { name: 'Gönder' }).click()
  await expect(sales).toHaveURL(/requests/)

  // 2) Doktor kabul eder
  const docCtx = await browser.newContext(); const doc = await docCtx.newPage()
  await login(doc, DOCTOR)
  await doc.goto('/doctor')
  await doc.getByRole('link', { name: 'Aç' }).first().click()
  await doc.getByRole('button', { name: 'Kabul' }).click()
  await doc.getByPlaceholder('Tedavi planı').fill('Önerilen: FUE 3000 greft')
  await doc.getByRole('button', { name: 'Kabul et' }).click()

  // 3) Satışçı planı görür
  await sales.goto('/requests')
  await sales.getByRole('link', { name: /Talep #/ }).first().click()
  await expect(sales.getByText('FUE 3000 greft')).toBeVisible()

  // 4) Aracı planı GÖREMEZ
  const agentCtx = await browser.newContext(); const agent = await agentCtx.newPage()
  await login(agent, AGENT)
  await agent.goto('/requests')
  // aracının kendi talebi yoksa liste boş; plan metni hiçbir şekilde görünmez
  await expect(agent.getByText('FUE 3000 greft')).toHaveCount(0)
})
```

Not: `tests/e2e/fixtures/sample.jpg` küçük bir örnek görsel eklenir. Seed kullanıcı e-posta/şifreleri `.env` üzerinden Playwright'a verilir.

- [ ] **Step 3: Testi çalıştır**

Run: `npx playwright install --with-deps` (ilk kez), sonra `npm run e2e`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: uçtan uca çekirdek akış + doktor planı izin sınırı (Playwright)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notları (spec kapsamı)

- **§2 sahiplenme sapması** → Task 4 (`aggregateStatus`, çoklu kabul), Task 11 (birden çok response). ✅
- **§3.1 talep girişi** → Task 9. **Eşzamanlı atama** → Task 9 (`resolveAssignees` + assignment insert). ✅
- **Doktor kabul/red + red gerekçe zorunlu + tedavi planı** → Task 11 + DB `check` (Task 5). ✅
- **Tüm doktorlar red → eskalasyon** → Task 4 + Task 11. ✅
- **Realtime bekleyen sayaç** → Task 10. ✅
- **§6 RLS + FR-21 izin sınırı** → Task 5 (RLS politikaları) + Task 12 (UI RoleGate) + Task 14 (E2E doğrulama). ✅
- **Koordinatör doktor tanımı + havuz + manuel yeniden atama** → Task 13. ✅
- **Durum yaşam döngüsü** → Task 2 + kullanım Task 9/11. ✅
- **Seed** → Task 6 + Task 7 (kullanıcılar). ✅
- **Audit** → Task 13 (reassign); temel düzey (M1 kapsamı). ✅
- **Kapsam dışı** (AI/skor/SLA/foto silme/mükerrer/push) M1'e alınmadı — doğru. ✅
```
