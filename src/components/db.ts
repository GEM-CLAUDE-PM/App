/**
 * db.ts — GEM&CLAUDE PM Pro / Nàng GEM Siêu Việt
 * Unified data persistence layer.
 *
 * Dev mode  (VITE_USE_SUPABASE != 'true') → localStorage (key-value JSON)
 * Prod mode (VITE_USE_SUPABASE = 'true')  → Supabase Postgres via RPC / REST
 *
 * All components import ONLY from this file — never touch localStorage directly.
 *
 * Usage:
 *   import { db } from './db';
 *   const items = await db.get<BOQItem[]>('qs_items', projectId, []);
 *   await db.set('qs_items', projectId, items);
 *   await db.remove('qs_items', projectId);
 *
 * COLLECTION REGISTRY
 * ─────────────────────────────────────────────────────────────────────────────
 *  Key                Table (Supabase)          Owner module
 * ─────────────────────────────────────────────────────────────────────────────
 *  qs_items           qs_items                  QSDashboard
 *  qs_acceptance      qs_acceptance             QSDashboard
 *  qs_payments        qs_payments               QSDashboard
 *  qs_subs            qs_subs                   QSDashboard
 *  qs_sub_payments    qs_sub_payments           QSDashboard
 *  qs_variation       qs_variation              QSDashboard
 *  qa_checklists      qa_checklists             QaQcDashboard
 *  qa_defects         qa_defects                QaQcDashboard
 *  qa_feedbacks       qa_feedbacks              QaQcDashboard
 *  gs_logs            gs_logs                   GiamSatDashboard
 *  gs_rfi             gs_rfi                    GiamSatDashboard
 *  contract_audit     contract_audit            ContractDashboard
 *  notif_rules        notif_rules               NotificationEngine
 *  notif_log          notif_log                 NotificationEngine
 *  office_congvan     office_congvan            OfficeDashboard
 *  office_meetings    office_meetings           OfficeDashboard
 *  office_approvals   office_approvals          OfficeDashboard
 *  office_minutes     office_minutes            OfficeDashboard
 *  mp_people          mp_people                 ManpowerDashboard
 *  mp_attendance      mp_attendance             ManpowerDashboard
 *  mp_payroll         mp_payroll                ManpowerDashboard
 *  hr_employees       hr_employees              HRWorkspace
 *  hr_leaves          hr_leaves                 HRWorkspace
 *  hr_contracts       hr_contracts              HRWorkspace
 *  hse_incidents      hse_incidents             HSEWorkspace
 *  hse_trainings      hse_trainings             HSEWorkspace
 *  hse_inspections    hse_inspections           HSEWorkspace
 *  hse_violations     hse_violations            HSEWorkspace
 *  hse_worker_certs   hse_worker_certs          HSEWorkspace
 *  calendar_events    calendar_events           CalendarSchedule
 *  contacts           contacts                  Contacts
 *  project_config     project_config            ProjectConfigPanel
 *  project_logo       project_logo              ProjectConfigPanel
 *  contract_sessions  contract_sessions         ContractDashboard
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getSupabase } from './supabase';

const USE_REAL = () => (import.meta as any).env?.VITE_USE_SUPABASE === 'true';

// ─── Local storage helpers ────────────────────────────────────────────────────
function lsKey(collection: string, projectId: string) {
  return `gem_db__${collection}__${projectId}`;
}
function lsGet<T>(collection: string, projectId: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(lsKey(collection, projectId));
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function lsSet<T>(collection: string, projectId: string, data: T): void {
  try { localStorage.setItem(lsKey(collection, projectId), JSON.stringify(data)); } catch {}
}
function lsRemove(collection: string, projectId: string): void {
  try { localStorage.removeItem(lsKey(collection, projectId)); } catch {}
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
/**
 * Collections stored as JSONB in a single generic key-value table:
 *   create table project_data (
 *     id          bigint generated always as identity primary key,
 *     project_id  uuid not null,
 *     collection  text not null,
 *     payload     jsonb not null default '[]',
 *     updated_at  timestamptz default now(),
 *     updated_by  uuid references auth.users,
 *     unique(project_id, collection)
 *   );
 *
 * This is the simplest migration path — one row per (project, collection).
 * For tables with many rows (e.g. audit log), a dedicated table is preferred.
 */
async function sbGet<T>(collection: string, projectId: string, fallback: T): Promise<T> {
  const sb = getSupabase();
  if (!sb) return lsGet(collection, projectId, fallback);
  try {
    const { data, error } = await sb
      .from('project_data')
      .select('payload')
      .eq('project_id', projectId)
      .eq('collection', collection)
      .maybeSingle();
    if (error) return lsGet(collection, projectId, fallback);
    if (!data) return lsGet(collection, projectId, fallback);
    // Sync server data về localStorage
    const result = (data.payload ?? fallback) as T;
    lsSet(collection, projectId, result);
    return result;
  } catch {
    return lsGet(collection, projectId, fallback);
  }
}

async function sbSet<T>(collection: string, projectId: string, payload: T, userId?: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb.from('project_data').upsert(
      { project_id: projectId, collection, payload, updated_at: new Date().toISOString(), updated_by: userId ?? null },
      { onConflict: 'project_id,collection' }
    );
    if (error) console.warn('[db] Supabase write error (table may not exist yet):', error.message);
  } catch (e) {
    console.warn('[db] Supabase unreachable, data saved to localStorage only');
  }
}

async function sbRemove(collection: string, projectId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from('project_data')
    .delete()
    .eq('project_id', projectId)
    .eq('collection', collection);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const db = {
  /**
   * Read a collection for a project.
   * Returns `fallback` if not found.
   */
  async get<T>(collection: string, projectId: string, fallback: T): Promise<T> {
    if (USE_REAL()) return sbGet(collection, projectId, fallback);
    return lsGet(collection, projectId, fallback);
  },

  /**
   * Write a collection for a project.
   * Auto-queues to IndexedDB when offline + prod mode.
   * Pass userId to track last-modified-by in Supabase.
   */
  async set<T>(collection: string, projectId: string, data: T, userId?: string): Promise<void> {
    // Always write to localStorage for instant UI responsiveness
    lsSet(collection, projectId, data);

    if (!USE_REAL()) return; // dev mode done

    if (!navigator.onLine) {
      // Offline + prod → queue for background sync
      try {
        const { OfflineQueue } = await import('./offlineQueue');
        await OfflineQueue.enqueue({ collection, project_id: projectId, payload: data, user_id: userId });
      } catch (e) { console.warn('[db] Failed to enqueue offline write:', e); }
      return;
    }

    // Online + prod → write directly to Supabase
    return sbSet(collection, projectId, data, userId);
  },

  /** Delete a collection for a project. */
  async remove(collection: string, projectId: string): Promise<void> {
    if (USE_REAL()) return sbRemove(collection, projectId);
    lsRemove(collection, projectId);
  },

  /**
   * Append one item to an array collection.
   * Reads current array, pushes item, writes back.
   * Keeps array size ≤ maxItems (drops oldest from front).
   */
  async push<T>(
    collection: string, projectId: string, item: T,
    maxItems = 500, userId?: string
  ): Promise<void> {
    const current = await db.get<T[]>(collection, projectId, []);
    const next = [...current, item].slice(-maxItems);
    await db.set(collection, projectId, next, userId);
  },

  /**
   * Read → transform → write in one call.
   * Useful for updating a single item inside an array by id.
   */
  async update<T extends { id: string | number }>(
    collection: string, projectId: string,
    id: string | number,
    patch: Partial<T>,
    userId?: string
  ): Promise<void> {
    const items = await db.get<T[]>(collection, projectId, []);
    const next = items.map(x => x.id === id ? { ...x, ...patch } : x);
    await db.set(collection, projectId, next, userId);
  },

  /**
   * Remove one item from an array collection by id.
   */
  async deleteItem<T extends { id: string | number }>(
    collection: string, projectId: string,
    id: string | number,
    userId?: string
  ): Promise<void> {
    const items = await db.get<T[]>(collection, projectId, []);
    await db.set(collection, projectId, items.filter(x => x.id !== id), userId);
  },
};

// ─── Typed collection helpers (strongly-typed wrappers) ───────────────────────
// Components can use these instead of raw db.get/set for IDE autocompletion.

export const ProjectDB = {
  // QS
  qsItems:      (pid: string) => ({ get: <T>(fb: T) => db.get<T>('qs_items',       pid, fb), set: <T>(d:T, uid?:string) => db.set('qs_items',       pid, d, uid) }),
  qsAcceptance: (pid: string) => ({ get: <T>(fb: T) => db.get<T>('qs_acceptance',  pid, fb), set: <T>(d:T, uid?:string) => db.set('qs_acceptance',  pid, d, uid) }),
  qsPayments:   (pid: string) => ({ get: <T>(fb: T) => db.get<T>('qs_payments',    pid, fb), set: <T>(d:T, uid?:string) => db.set('qs_payments',    pid, d, uid) }),
  qsSubs:       (pid: string) => ({ get: <T>(fb: T) => db.get<T>('qs_subs',        pid, fb), set: <T>(d:T, uid?:string) => db.set('qs_subs',        pid, d, uid) }),
  qsSubPay:     (pid: string) => ({ get: <T>(fb: T) => db.get<T>('qs_sub_payments',pid, fb), set: <T>(d:T, uid?:string) => db.set('qs_sub_payments',pid, d, uid) }),
  qsVariation:  (pid: string) => ({ get: <T>(fb: T) => db.get<T>('qs_variation',   pid, fb), set: <T>(d:T, uid?:string) => db.set('qs_variation',   pid, d, uid) }),

  // QA/QC
  qaChecklists: (pid: string) => ({ get: <T>(fb: T) => db.get<T>('qa_checklists',  pid, fb), set: <T>(d:T, uid?:string) => db.set('qa_checklists',  pid, d, uid) }),
  qaDefects:    (pid: string) => ({ get: <T>(fb: T) => db.get<T>('qa_defects',     pid, fb), set: <T>(d:T, uid?:string) => db.set('qa_defects',     pid, d, uid) }),
  qaFeedbacks:  (pid: string) => ({ get: <T>(fb: T) => db.get<T>('qa_feedbacks',   pid, fb), set: <T>(d:T, uid?:string) => db.set('qa_feedbacks',   pid, d, uid) }),

  // Giám sát
  gsLogs:       (pid: string) => ({ get: <T>(fb: T) => db.get<T>('gs_logs',        pid, fb), set: <T>(d:T, uid?:string) => db.set('gs_logs',        pid, d, uid) }),
  gsRfi:        (pid: string) => ({ get: <T>(fb: T) => db.get<T>('gs_rfi',         pid, fb), set: <T>(d:T, uid?:string) => db.set('gs_rfi',         pid, d, uid) }),

  // Contract audit
  contractAudit:(pid: string) => ({ get: <T>(fb: T) => db.get<T>('contract_audit', pid, fb), push: <T>(item:T, uid?:string) => db.push('contract_audit', pid, item, 200, uid) }),

  // Office
  congvan:      (pid: string) => ({ get: <T>(fb: T) => db.get<T>('office_congvan',   pid, fb), set: <T>(d:T, uid?:string) => db.set('office_congvan',   pid, d, uid) }),
  meetings:     (pid: string) => ({ get: <T>(fb: T) => db.get<T>('office_meetings',  pid, fb), set: <T>(d:T, uid?:string) => db.set('office_meetings',  pid, d, uid) }),
  approvals:    (pid: string) => ({ get: <T>(fb: T) => db.get<T>('office_approvals', pid, fb), set: <T>(d:T, uid?:string) => db.set('office_approvals', pid, d, uid) }),
  minutes:      (pid: string) => ({ get: <T>(fb: T) => db.get<T>('office_minutes',   pid, fb), set: <T>(d:T, uid?:string) => db.set('office_minutes',   pid, d, uid) }),

  // Notifications
  notifRules:   (pid: string) => ({ get: <T>(fb: T) => db.get<T>('notif_rules',     pid, fb), set: <T>(d:T, uid?:string) => db.set('notif_rules',     pid, d, uid) }),
  notifLog:     (pid: string) => ({ get: <T>(fb: T) => db.get<T>('notif_log',       pid, fb), push: <T>(item:T, uid?:string) => db.push('notif_log',   pid, item, 300, uid) }),

  // Manpower
  mpPeople:     (pid: string) => ({ get: <T>(fb: T) => db.get<T>('mp_people',       pid, fb), set: <T>(d:T, uid?:string) => db.set('mp_people',       pid, d, uid) }),
  mpAttendance: (pid: string) => ({ get: <T>(fb: T) => db.get<T>('mp_attendance',   pid, fb), set: <T>(d:T, uid?:string) => db.set('mp_attendance',   pid, d, uid) }),
  mpPayroll:    (pid: string) => ({ get: <T>(fb: T) => db.get<T>('mp_payroll',      pid, fb), set: <T>(d:T, uid?:string) => db.set('mp_payroll',      pid, d, uid) }),

  // HR
  hrEmployees:  (pid: string) => ({ get: <T>(fb: T) => db.get<T>('hr_employees',    pid, fb), set: <T>(d:T, uid?:string) => db.set('hr_employees',    pid, d, uid) }),
  hrLeaves:     (pid: string) => ({ get: <T>(fb: T) => db.get<T>('hr_leaves',       pid, fb), set: <T>(d:T, uid?:string) => db.set('hr_leaves',       pid, d, uid) }),
  hrContracts:  (pid: string) => ({ get: <T>(fb: T) => db.get<T>('hr_contracts',    pid, fb), set: <T>(d:T, uid?:string) => db.set('hr_contracts',    pid, d, uid) }),

  // HSE
  hseIncidents:   (pid: string) => ({ get: <T>(fb: T) => db.get<T>('hse_incidents',   pid, fb), set: <T>(d:T, uid?:string) => db.set('hse_incidents',   pid, d, uid) }),
  hseTrainings:   (pid: string) => ({ get: <T>(fb: T) => db.get<T>('hse_trainings',   pid, fb), set: <T>(d:T, uid?:string) => db.set('hse_trainings',   pid, d, uid) }),
  hseInspections: (pid: string) => ({ get: <T>(fb: T) => db.get<T>('hse_inspections', pid, fb), set: <T>(d:T, uid?:string) => db.set('hse_inspections', pid, d, uid) }),
  hseViolations:  (pid: string) => ({ get: <T>(fb: T) => db.get<T>('hse_violations',  pid, fb), set: <T>(d:T, uid?:string) => db.set('hse_violations',  pid, d, uid) }),
  hseWorkerCerts: (pid: string) => ({ get: <T>(fb: T) => db.get<T>('hse_worker_certs',pid, fb), set: <T>(d:T, uid?:string) => db.set('hse_worker_certs',pid, d, uid) }),

  // Calendar & Contacts (global — pid = 'global' or userId)
  calendarEvents: (pid: string) => ({ get: <T>(fb: T) => db.get<T>('calendar_events', pid, fb), set: <T>(d:T, uid?:string) => db.set('calendar_events', pid, d, uid) }),
  contacts:       (pid: string) => ({ get: <T>(fb: T) => db.get<T>('contacts',        pid, fb), set: <T>(d:T, uid?:string) => db.set('contacts',        pid, d, uid) }),

  // Project config
  projectConfig:  (pid: string) => ({ get: <T>(fb: T) => db.get<T>('project_config',  pid, fb), set: <T>(d:T, uid?:string) => db.set('project_config',  pid, d, uid) }),
  projectLogo:    (pid: string) => ({ get: <T>(fb: T) => db.get<T>('project_logo',    pid, fb), set: <T>(d:T, uid?:string) => db.set('project_logo',    pid, d, uid) }),

  // Contract
  contractSessions: (pid: string) => ({ get: <T>(fb: T) => db.get<T>('contract_sessions', pid, fb), set: <T>(d:T, uid?:string) => db.set('contract_sessions', pid, d, uid) }),
};

// ─── Realtime Sync Hook ───────────────────────────────────────────────────────
import { useEffect } from 'react';
/**
 * useRealtimeSync(projectId, collections, onRefresh)
 * Subscribe Supabase Realtime → gọi onRefresh khi thiết bị khác update.
 * Dev mode: no-op. Tự cleanup khi unmount. Debounce 300ms.
 */
export function useRealtimeSync(
  projectId: string,
  collections: string[],
  onRefresh: () => void,
) {
  useEffect(() => {
    if (!USE_REAL()) return;
    const sb = getSupabase();
    if (!sb) return;
    let timer: ReturnType<typeof setTimeout>;
    const ch = sb.channel(`gem_project:${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'project_data',
        filter: `project_id=eq.${projectId}`,
      }, (payload: any) => {
        const col = payload.new?.collection ?? payload.old?.collection;
        if (collections.length && !collections.includes(col)) return;
        clearTimeout(timer);
        timer = setTimeout(onRefresh, 300);
      })
      .subscribe();
    return () => { clearTimeout(timer); sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
}

/*
 * ── Supabase SQL Migration ────────────────────────────────────────────────────
 * Run once in Supabase SQL Editor:
 *
 * -- Generic JSONB key-value store (one row per project+collection)
 * create table public.project_data (
 *   id           bigint generated always as identity primary key,
 *   project_id   text not null,
 *   collection   text not null,
 *   payload      jsonb not null default '[]'::jsonb,
 *   updated_at   timestamptz default now(),
 *   updated_by   uuid references auth.users on delete set null,
 *   constraint project_data_uniq unique (project_id, collection)
 * );
 * alter table public.project_data enable row level security;
 *
 * -- Members of a project can read
 * create policy "project_data_read" on public.project_data
 *   for select using (
 *     auth.role() = 'authenticated'
 *   );
 *
 * -- Authenticated users can write (fine-grained control via app-layer Permissions)
 * create policy "project_data_write" on public.project_data
 *   for all using (auth.role() = 'authenticated')
 *   with check (auth.role() = 'authenticated');
 *
 * -- Index for fast lookup
 * create index project_data_lookup on public.project_data (project_id, collection);
 *
 * -- Auto-update updated_at
 * create or replace function touch_updated_at()
 * returns trigger language plpgsql as $$
 * begin new.updated_at = now(); return new; end;
 * $$;
 * create trigger project_data_touch
 *   before update on public.project_data
 *   for each row execute procedure touch_updated_at();
 */
