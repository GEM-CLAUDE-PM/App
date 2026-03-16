/**
 * supabase.ts — GEM&CLAUDE PM Pro / Nàng GEM Siêu Việt
 * Supabase client, type definitions, RLS helpers, and migration utilities.
 *
 * Phase 3: Replace localStorage role switcher with JWT auth + Row Level Security.
 *
 * SETUP (one-time):
 *   1. Create project at https://supabase.com
 *   2. Add to .env:
 *        VITE_SUPABASE_URL=https://xxxx.supabase.co
 *        VITE_SUPABASE_ANON_KEY=eyJhbGci...
 *   3. Run SQL migrations in /supabase/migrations/ (see bottom of this file)
 *   4. Set VITE_USE_SUPABASE=true to activate real auth
 */

import { createClient } from '@supabase/supabase-js';

// ─── Supabase JS client (lazy-init so build works without env vars) ──────────
let _supabase: any = null;

export function getSupabase() {
  if (_supabase) return _supabase;
  const url  = (import.meta as any).env?.VITE_SUPABASE_URL;
  const key  = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // dev mode — auth context will use mock
  try {
    _supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    console.warn('[GEM] supabase-js not installed. Run: npm install @supabase/supabase-js');
  }
  return _supabase;
}

// ─── Role definitions ────────────────────────────────────────────────────────
/**
 * 3-tier role hierarchy:
 *   admin   → Ban lãnh đạo, GĐ DA, Kế toán trưởng (full access incl. financials)
 *   manager → Chỉ huy trưởng, TVGS, QS, QA/QC, KS Giám sát (project access)
 *   worker  → Operator, HSE Officer, HR (limited — own workspace only)
 *
 * Job roles are stored as user metadata, not as RLS roles.
 */
export type TierRole  = 'admin' | 'manager' | 'worker';
export type JobRole   =
  | 'giam_doc'          // Giám đốc DA          → admin tier
  | 'ke_toan'           // Kế toán / KTT         → admin tier
  | 'chi_huy_truong'    // Chỉ huy trưởng        → manager tier
  | 'tvgs'              // Tư vấn giám sát       → manager tier
  | 'qs'                // Quantity Surveyor     → manager tier
  | 'qa_qc'             // QA/QC Engineer        → manager tier
  | 'ks_giam_sat'       // Kỹ sư giám sát        → manager tier
  | 'hr'                // HR / Nhân sự          → manager tier
  | 'thu_ky'            // Thư ký / Hành chính   → manager tier
  | 'hse'               // HSE Officer           → worker tier
  | 'operator'          // Vận hành Thiết bị     → worker tier
  | 'ntp'               // Nhà thầu phụ          → worker tier (external)
  | 'chu_dau_tu'        // Chủ đầu tư (CĐT)      → worker tier (read-only portal)
  ;

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  job_role: JobRole;
  tier: TierRole;
  avatar_url?: string;
  phone?: string;
  project_ids: string[];        // Projects this user belongs to
  created_at: string;
  last_sign_in?: string;
}

export interface AuthSession {
  user: UserProfile;
  access_token: string;
  expires_at: number;
}

// ─── Role → Tier mapping ─────────────────────────────────────────────────────
export const JOB_TO_TIER: Record<JobRole, TierRole> = {
  giam_doc:       'admin',
  ke_toan:        'admin',
  chi_huy_truong: 'manager',
  tvgs:           'manager',
  qs:             'manager',
  qa_qc:          'manager',
  ks_giam_sat:    'manager',
  hr:             'manager',
  thu_ky:         'manager',
  hse:            'worker',
  operator:       'worker',
  ntp:            'worker',
  chu_dau_tu:     'worker',
};

export const JOB_LABELS: Record<JobRole, string> = {
  giam_doc:       'Giám đốc DA',
  ke_toan:        'Kế toán / KTT',
  chi_huy_truong: 'Chỉ huy trưởng',
  tvgs:           'Tư vấn giám sát',
  qs:             'Quantity Surveyor',
  qa_qc:          'QA/QC Engineer',
  ks_giam_sat:    'Kỹ sư Giám sát',
  hr:             'HR / Nhân sự',
  thu_ky:         'Thư ký / Hành chính',
  hse:            'HSE Officer',
  operator:       'Vận hành Thiết bị',
  ntp:            'Nhà thầu phụ',
  chu_dau_tu:     'Chủ đầu tư',
};

export const TIER_LABELS: Record<TierRole, string> = {
  admin:   'Admin — Lãnh đạo',
  manager: 'Manager — Quản lý',
  worker:  'Worker — Công trường',
};

export const TIER_COLORS: Record<TierRole, { bg: string; text: string; border: string }> = {
  admin:   { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  manager: { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200'   },
  worker:  { bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-200'},
};

// ─── Permission helpers ───────────────────────────────────────────────────────
export class Permissions {
  constructor(private profile: UserProfile | null) {}

  get tier(): TierRole | null { return this.profile?.tier ?? null; }
  get job():  JobRole  | null { return this.profile?.job_role ?? null; }

  is(tier: TierRole)  { return this.tier === tier; }
  atLeast(tier: TierRole) {
    const order: TierRole[] = ['worker', 'manager', 'admin'];
    return order.indexOf(this.tier ?? 'worker') >= order.indexOf(tier);
  }
  hasJob(...jobs: JobRole[]) { return jobs.includes(this.job as JobRole); }

  // Tab-level access
  get canViewContracts()    { return this.atLeast('manager'); }
  get canViewFullFinancials(){ return this.hasJob('giam_doc','ke_toan'); }
  get canEditContracts()    { return this.hasJob('giam_doc','ke_toan'); }
  get canViewQS()           { return this.atLeast('manager'); }
  get canEditQS()           { return this.hasJob('giam_doc','ke_toan','qs'); }
  get canViewHR()           { return this.atLeast('manager'); }
  get canEditHR()           { return this.hasJob('giam_doc','hr'); }
  get canViewHSE()          { return this.atLeast('worker'); }
  get canEditHSE()          { return this.hasJob('giam_doc','hse','chi_huy_truong'); }
  get canViewAccounting()   { return this.hasJob('giam_doc','ke_toan'); }
  get canManageUsers()      { return this.hasJob('giam_doc'); }
  get canApproveVO()        { return this.hasJob('giam_doc','ke_toan'); }
  get canApprovePayment()   { return this.hasJob('giam_doc','ke_toan'); }
  get canViewSalary()       { return this.hasJob('giam_doc','ke_toan','hr'); }
  get canViewContractValues(){ return this.hasJob('giam_doc','ke_toan','qs'); }
}

// ─── Mock users (dev mode — before Supabase) ─────────────────────────────────
export const MOCK_USERS: UserProfile[] = [
  {
    id: 'u1', email: 'gdda@villaphat.vn', full_name: 'Trần Văn Bình',
    job_role: 'giam_doc', tier: 'admin',
    project_ids: ['p1','p2'], created_at: '2025-01-01',
    phone: '0901234567',
  },
  {
    id: 'u2', email: 'ketoan@villaphat.vn', full_name: 'Nguyễn Thu Hà',
    job_role: 'ke_toan', tier: 'admin',
    project_ids: ['p1','p2'], created_at: '2025-01-01',
    phone: '0902345678',
  },
  {
    id: 'u3', email: 'cht@villaphat.vn', full_name: 'Nguyễn Văn Anh',
    job_role: 'chi_huy_truong', tier: 'manager',
    project_ids: ['p1'], created_at: '2025-01-01',
    phone: '0903456789',
  },
  {
    id: 'u4', email: 'qs@villaphat.vn', full_name: 'Lê Minh Tuấn',
    job_role: 'qs', tier: 'manager',
    project_ids: ['p1','p2'], created_at: '2025-01-01',
  },
  {
    id: 'u5', email: 'qaqc@villaphat.vn', full_name: 'Phạm Thị Thảo',
    job_role: 'qa_qc', tier: 'manager',
    project_ids: ['p1'], created_at: '2025-01-01',
  },
  {
    id: 'u6', email: 'gsat@villaphat.vn', full_name: 'Hoàng Việt Hùng',
    job_role: 'ks_giam_sat', tier: 'manager',
    project_ids: ['p1'], created_at: '2025-01-01',
  },
  {
    id: 'u7', email: 'hse@villaphat.vn', full_name: 'Lê Văn Hải',
    job_role: 'hse', tier: 'worker',
    project_ids: ['p1'], created_at: '2025-01-01',
  },
  {
    id: 'u8', email: 'hr@villaphat.vn', full_name: 'Nguyễn Minh Đức',
    job_role: 'hr', tier: 'manager',
    project_ids: ['p1','p2'], created_at: '2025-01-01',
  },
  {
    id: 'u9', email: 'thuky@villaphat.vn', full_name: 'Nguyễn Thị Lan',
    job_role: 'thu_ky', tier: 'manager',
    project_ids: ['p1','p2'], created_at: '2025-01-01',
  },
  {
    id: 'u10', email: 'op01@villaphat.vn', full_name: 'Trần Quốc Tuấn',
    job_role: 'operator', tier: 'worker',
    project_ids: ['p1'], created_at: '2025-01-01',
  },
  // ── Portal users ──────────────────────────────────────────────────────────
  {
    id: 'ntp01', email: 'ntp@phucthanh.vn', full_name: 'NTP Phúc Thành',
    job_role: 'ntp', tier: 'worker',
    project_ids: ['p1'], created_at: '2025-01-01',
    phone: '0909123456',
  },
  {
    id: 'cdt01', email: 'cdt@villaphat.vn', full_name: 'Chủ đầu tư Villa PAT',
    job_role: 'chu_dau_tu', tier: 'worker',
    project_ids: ['p1'], created_at: '2025-01-01',
    phone: '0901999888',
  },
];

// ─── Auth service — wraps Supabase or falls back to mock ─────────────────────
export const AuthService = {
  /**
   * Sign in with email + password.
   * Dev mode: matches against MOCK_USERS by email, accepts any password.
   * Prod mode: delegates to Supabase Auth.
   */
  async signIn(email: string, password: string): Promise<{ user: UserProfile | null; error: string | null }> {
    const sb = getSupabase();
    const useReal = (import.meta as any).env?.VITE_USE_SUPABASE === 'true';

    if (sb && useReal) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message };
      // Fetch profile from profiles table
      const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
      return { user: profile ?? null, error: null };
    }

    // Dev mock: find user by email, any password accepted
    const mock = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!mock) return { user: null, error: 'Email không tồn tại trong hệ thống.' };
    if (!password) return { user: null, error: 'Vui lòng nhập mật khẩu.' };
    // Simulate network delay
    await new Promise(r => setTimeout(r, 600));
    return { user: mock, error: null };
  },

  async signOut(): Promise<void> {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    localStorage.removeItem('gem_auth_user');
    localStorage.removeItem('gem_user_role');
  },

  /** Restore session from localStorage (dev) or Supabase session (prod) */
  async restoreSession(): Promise<UserProfile | null> {
    const sb = getSupabase();
    const useReal = (import.meta as any).env?.VITE_USE_SUPABASE === 'true';
    if (sb && useReal) {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const { data: profile } = await sb.from('profiles').select('*').eq('id', data.session.user.id).single();
      return profile ?? null;
    }
    try {
      const stored = localStorage.getItem('gem_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  },

  /** Persist session to localStorage (dev mode) */
  persistSession(user: UserProfile): void {
    localStorage.setItem('gem_auth_user', JSON.stringify(user));
    // Keep legacy role key for backward compat with ContractDashboard
    localStorage.setItem('gem_user_role', user.job_role);
  },
};

// ─── Supabase SQL Migrations ─────────────────────────────────────────────────
/**
 * Run these in Supabase SQL Editor (Settings > SQL Editor).
 *
 * -- 1. Profiles table (extends auth.users)
 * create table public.profiles (
 *   id          uuid references auth.users on delete cascade primary key,
 *   email       text unique not null,
 *   full_name   text not null,
 *   job_role    text not null,          -- JobRole enum value
 *   tier        text not null,          -- 'admin' | 'manager' | 'worker'
 *   phone       text,
 *   avatar_url  text,
 *   project_ids text[] default '{}',
 *   created_at  timestamptz default now()
 * );
 * alter table public.profiles enable row level security;
 *
 * -- Users can read their own profile; admins read all
 * create policy "profiles_self_read" on public.profiles
 *   for select using (auth.uid() = id);
 * create policy "profiles_admin_read" on public.profiles
 *   for select using (
 *     exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
 *   );
 *
 * -- 2. Projects table
 * create table public.projects (
 *   id          uuid default gen_random_uuid() primary key,
 *   name        text not null,
 *   status      text default 'in_progress',
 *   created_at  timestamptz default now()
 * );
 * alter table public.projects enable row level security;
 * create policy "projects_member_read" on public.projects
 *   for select using (
 *     exists (select 1 from public.profiles where id = auth.uid() and id::text = any(project_ids::text[]))
 *   );
 *
 * -- 3. Audit log table (append-only)
 * create table public.audit_log (
 *   id          bigint generated always as identity primary key,
 *   user_id     uuid references auth.users,
 *   project_id  uuid,
 *   action      text not null,
 *   detail      text,
 *   created_at  timestamptz default now()
 * );
 * alter table public.audit_log enable row level security;
 * create policy "audit_insert" on public.audit_log
 *   for insert with check (auth.uid() = user_id);
 * create policy "audit_admin_read" on public.audit_log
 *   for select using (
 *     exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
 *   );
 *
 * -- 4. Trigger: auto-create profile on signup
 * create or replace function public.handle_new_user()
 * returns trigger language plpgsql security definer as $$
 * begin
 *   insert into public.profiles (id, email, full_name, job_role, tier)
 *   values (
 *     new.id,
 *     new.email,
 *     coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
 *     coalesce(new.raw_user_meta_data->>'job_role', 'worker'),
 *     coalesce(new.raw_user_meta_data->>'tier', 'worker')
 *   );
 *   return new;
 * end;
 * $$;
 * create trigger on_auth_user_created
 *   after insert on auth.users
 *   for each row execute procedure public.handle_new_user();
 */

// ─── S7 SQL Migrations — Thêm vào Supabase SQL Editor ────────────────────────
/**
 * -- ══════════════════════════════════════════════════════════════════════
 * -- S7 MIGRATIONS — Chạy sau 4 migrations cũ (profiles, projects, audit_log, trigger)
 * -- ══════════════════════════════════════════════════════════════════════
 *
 * -- 5. Project Members table
 * -- Lưu: ai thuộc project nào, với role nào, allowedProjectIds scope
 * create table public.project_members (
 *   id              uuid default gen_random_uuid() primary key,
 *   project_id      uuid references public.projects on delete cascade not null,
 *   user_id         uuid references auth.users on delete cascade not null,
 *   roles           text[] not null default '{}',      -- RoleId[]
 *   active_role_id  text not null,                     -- RoleId hiện tại
 *   granted_extras  jsonb,                             -- delegation/boost tạm thời
 *   joined_at       timestamptz default now(),
 *   updated_at      timestamptz default now(),
 *   unique(project_id, user_id)
 * );
 * alter table public.project_members enable row level security;
 *
 * -- Member tự đọc record của mình
 * create policy "pm_self_read" on public.project_members
 *   for select using (auth.uid() = user_id);
 *
 * -- Member đọc được tất cả members cùng project
 * create policy "pm_project_read" on public.project_members
 *   for select using (
 *     exists (
 *       select 1 from public.project_members pm2
 *       where pm2.project_id = project_members.project_id
 *         and pm2.user_id = auth.uid()
 *     )
 *   );
 *
 * -- Chỉ admin tier mới INSERT/UPDATE/DELETE project_members
 * create policy "pm_admin_write" on public.project_members
 *   for all using (
 *     exists (
 *       select 1 from public.profiles where id = auth.uid() and tier = 'admin'
 *     )
 *   );
 *
 * -- Trigger: sync project_ids vào profiles khi member được thêm/xóa
 * create or replace function public.sync_profile_project_ids()
 * returns trigger language plpgsql security definer as $$
 * begin
 *   if (TG_OP = 'INSERT') then
 *     update public.profiles
 *       set project_ids = array_append(project_ids, NEW.project_id::text)
 *       where id = NEW.user_id
 *         and not (project_ids @> array[NEW.project_id::text]);
 *   elsif (TG_OP = 'DELETE') then
 *     update public.profiles
 *       set project_ids = array_remove(project_ids, OLD.project_id::text)
 *       where id = OLD.user_id;
 *   end if;
 *   return coalesce(NEW, OLD);
 * end;
 * $$;
 * create trigger on_project_member_change
 *   after insert or delete on public.project_members
 *   for each row execute procedure public.sync_profile_project_ids();
 *
 *
 * -- 6. Delegations table
 * -- Lưu: ủy quyền tạm thời giữa 2 user
 * create table public.delegations (
 *   id              uuid default gen_random_uuid() primary key,
 *   project_id      uuid references public.projects on delete cascade not null,
 *   from_user_id    uuid references auth.users not null,
 *   to_user_id      uuid references auth.users not null,
 *   from_role_id    text not null,
 *   to_role_id      text not null,
 *   doc_types       text[],                -- null = tất cả doc types
 *   level_grant     int not null default 1,
 *   domain_grant    text[] not null default '{}',
 *   reason          text not null,
 *   note            text,
 *   start_at        timestamptz not null default now(),
 *   end_at          timestamptz not null,
 *   status          text not null default 'active', -- active | expired | revoked
 *   created_at      timestamptz default now(),
 *   revoked_at      timestamptz,
 *   revoked_by      uuid references auth.users
 * );
 * alter table public.delegations enable row level security;
 *
 * -- Đọc: người ủy quyền hoặc người được ủy quyền hoặc admin
 * create policy "del_parties_read" on public.delegations
 *   for select using (
 *     auth.uid() = from_user_id
 *     or auth.uid() = to_user_id
 *     or exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
 *   );
 *
 * -- Tạo delegation: phải là member của project, level >= 2 (L3+)
 * create policy "del_member_insert" on public.delegations
 *   for insert with check (
 *     auth.uid() = from_user_id
 *     and exists (
 *       select 1 from public.project_members
 *       where project_id = delegations.project_id and user_id = auth.uid()
 *     )
 *   );
 *
 * -- Revoke: chỉ người tạo hoặc admin
 * create policy "del_revoke_update" on public.delegations
 *   for update using (
 *     auth.uid() = from_user_id
 *     or exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
 *   );
 *
 *
 * -- 7. Project Templates table
 * -- Lưu: loại công trình đã chọn cho từng project
 * create table public.project_templates (
 *   project_id   uuid references public.projects on delete cascade primary key,
 *   template_id  text not null,      -- ProjectTypeId
 *   applied_at   timestamptz default now(),
 *   applied_by   uuid references auth.users
 * );
 * alter table public.project_templates enable row level security;
 *
 * -- Đọc: project member
 * create policy "pt_member_read" on public.project_templates
 *   for select using (
 *     exists (
 *       select 1 from public.project_members
 *       where project_id = project_templates.project_id and user_id = auth.uid()
 *     )
 *   );
 *
 * -- Ghi: chỉ PM hoặc admin (active_role_id IN ('pm','giam_doc','admin'))
 * create policy "pt_pm_write" on public.project_templates
 *   for all using (
 *     exists (
 *       select 1 from public.project_members
 *       where project_id = project_templates.project_id
 *         and user_id = auth.uid()
 *         and active_role_id in ('pm','giam_doc')
 *     )
 *     or exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
 *   );
 *
 *
 * -- 8. Approvals table
 * -- Lưu: tất cả document cần phê duyệt
 * create table public.approvals (
 *   id               uuid default gen_random_uuid() primary key,
 *   project_id       uuid references public.projects on delete cascade not null,
 *   doc_type         text not null,             -- DocType (28 loại)
 *   doc_ref          text,                      -- Mã tham chiếu nội bộ
 *   title            text not null,
 *   amount           numeric default 0,
 *   workflow_steps   jsonb not null default '[]',
 *   current_step_id  text,
 *   status           text not null default 'PENDING_REVIEW',
 *   thresholds       jsonb,
 *   created_by       uuid references auth.users not null,
 *   created_at       timestamptz default now(),
 *   updated_at       timestamptz default now()
 * );
 * alter table public.approvals enable row level security;
 *
 * -- Đọc: project member
 * create policy "ap_member_read" on public.approvals
 *   for select using (
 *     exists (
 *       select 1 from public.project_members
 *       where project_id = approvals.project_id and user_id = auth.uid()
 *     )
 *   );
 *
 * -- Tạo: bất kỳ project member
 * create policy "ap_member_insert" on public.approvals
 *   for insert with check (
 *     auth.uid() = created_by
 *     and exists (
 *       select 1 from public.project_members
 *       where project_id = approvals.project_id and user_id = auth.uid()
 *     )
 *   );
 *
 * -- Update (status, current_step): qua RPC — không cho direct UPDATE từ client
 * -- (dùng Supabase Edge Function hoặc server-side để validate canActOnStep)
 *
 *
 * -- 9. Approval Actions table — append-only audit trail
 * -- Lưu: mỗi hành động REVIEW/APPROVE/REJECT/RETURN
 * create table public.approval_actions (
 *   id           bigint generated always as identity primary key,
 *   approval_id  uuid references public.approvals on delete cascade not null,
 *   step_id      text not null,
 *   action_type  text not null,     -- REVIEW | APPROVE | REJECT | RETURN
 *   actor_id     uuid references auth.users not null,
 *   actor_role   text not null,     -- RoleId tại thời điểm action
 *   pin_verified boolean default false,
 *   comment      text,
 *   acted_at     timestamptz default now()
 * );
 * alter table public.approval_actions enable row level security;
 *
 * -- Đọc: project member (join qua approvals)
 * create policy "aa_member_read" on public.approval_actions
 *   for select using (
 *     exists (
 *       select 1 from public.approvals ap
 *       join public.project_members pm on pm.project_id = ap.project_id
 *       where ap.id = approval_actions.approval_id
 *         and pm.user_id = auth.uid()
 *     )
 *   );
 *
 * -- Insert: chỉ actor_id = auth.uid() — không cho insert thay người khác
 * create policy "aa_actor_insert" on public.approval_actions
 *   for insert with check (auth.uid() = actor_id);
 *
 * -- KHÔNG có UPDATE/DELETE policy — append-only
 *
 *
 * -- 10. Realtime: enable cho approvals để badge update live
 * -- Chạy trong Supabase Dashboard > Database > Replication:
 * --   Bật replication cho bảng: approvals, approval_actions
 * -- Hoặc via SQL:
 * alter publication supabase_realtime add table public.approvals;
 * alter publication supabase_realtime add table public.approval_actions;
 */

// ─── RoleId → allowedProjectIds helper (dùng sau khi Auth thật) ──────────────
/**
 * Sau khi user sign in với Supabase Auth thật:
 * 1. Đọc profiles.job_role → map sang RoleId trong permissions.ts
 * 2. Đọc profiles.project_ids → allowedProjectIds
 * 3. Feed vào UserContext / buildCtxFromMember
 *
 * Mapping JobRole (supabase.ts) → RoleId (permissions.ts):
 *   giam_doc        → 'giam_doc'
 *   ke_toan         → 'ke_toan_truong'
 *   chi_huy_truong  → 'chi_huy_truong'
 *   tvgs            → 'ks_giam_sat'
 *   qs              → 'truong_qs'
 *   qa_qc           → 'truong_qaqc'
 *   ks_giam_sat     → 'ks_giam_sat'
 *   hr              → 'thu_ky_ho'
 *   thu_ky          → 'thu_ky_site'
 *   hse             → 'hse_site'
 *   operator        → 'thu_kho'
 *   ntp             → 'qs_site'
 */
export const JOB_ROLE_TO_ROLE_ID: Record<string, string> = {
  giam_doc:       'giam_doc',
  ke_toan:        'ke_toan_truong',
  chi_huy_truong: 'chi_huy_truong',
  tvgs:           'ks_giam_sat',
  qs:             'truong_qs',
  qa_qc:          'truong_qaqc',
  ks_giam_sat:    'ks_giam_sat',
  hr:             'thu_ky_ho',
  thu_ky:         'thu_ky_site',
  hse:            'hse_site',
  operator:       'thu_kho',
  ntp:            'qs_site',
};
