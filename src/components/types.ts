// ── GEM&CLAUDE PM Pro — Shared Types (V1.0) ──────────────────────────────────
// Single source of truth cho tất cả types dùng chung giữa các module
// Import: import type { Project, DashboardProps, ... } from './types'
// ──────────────────────────────────────────────────────────────────────────────
import type { UserContext } from './permissions';

// ─── Core Project ─────────────────────────────────────────────────────────────
export interface Project {
  id:         string;
  name:       string;
  type?:      'in_progress' | 'potential' | 'completed';
  status?:    string;
  progress?:  number;
  budget?:    string;
  startDate?: string;
  endDate?:   string;
  address?:   string;
  spi?:       number | null;
  cpi?:       number | null;
  ncr?:       number;
  hse?:       number;
  ntp_pending?: number;
  contractValue?: number;
  [key: string]: any; // allow extra fields during migration
}

// ─── Standard Dashboard Props ─────────────────────────────────────────────────
// Chuẩn cho TẤT CẢ dashboard modules từ Foundation Sprint trở đi
// Các module cũ dùng `project: any` vẫn hoạt động qua [key: string]: any trên Project
export interface DashboardProps {
  project:    Project;
  projectId:  string;       // always string — không optional
  ctx?:       UserContext;  // optional cho backward compat, dần dần required
  readOnly?:  boolean;
}

// ─── Re-export UserContext để các module chỉ cần import từ './types' ─────────
export type { UserContext };

// ─── Navigation ───────────────────────────────────────────────────────────────
export type NavHandler = (tab: string, projectId?: string, subTab?: string) => void;

// ─── Common status types ──────────────────────────────────────────────────────
export type ApprStatus  = 'draft' | 'pending' | 'approved' | 'rejected' | 'returned';
export type LoadState   = 'idle' | 'loading' | 'success' | 'error';

// ─── Audit log entry ──────────────────────────────────────────────────────────
export interface AuditEntry {
  id:        string;
  projectId: string;
  userId:    string;
  action:    string;
  detail?:   string;
  ts:        string; // ISO datetime
}

// ─── File / Document attachment ───────────────────────────────────────────────
export interface Attachment {
  id:       string;
  name:     string;
  url:      string;
  size?:    number;
  mimeType?: string;
  uploadedAt: string;
  uploadedBy: string;
}

// ─── GPS / Location ───────────────────────────────────────────────────────────
export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: string;
}

// ─── Zalo notification ────────────────────────────────────────────────────────
export interface ZaloPayload {
  title:      string;
  body:       string;
  recipients: Array<{ name: string; user_id?: string }>;
  emoji?:     string;
  url?:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Extract projectId từ project object hoặc string prop — chuẩn hóa */
export function resolveProjectId(project?: Project | null, projectIdProp?: string): string {
  return projectIdProp || project?.id || 'default';
}

/** Tạo DashboardProps từ legacy (project: any) pattern */
export function toDashboardProps(project: any, ctx?: UserContext): DashboardProps {
  return {
    project:   project as Project,
    projectId: project?.id || 'default',
    ctx,
  };
}
