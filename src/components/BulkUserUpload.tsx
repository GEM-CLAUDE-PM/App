/**
 * BulkUserUpload.tsx — GEM&CLAUDE PM Pro
 * Tạo users hàng loạt từ file Excel.
 * Flow: Upload Excel → Parse → Preview → Confirm → Gọi Edge Function bulk-create-users
 *
 * Excel format (3 cột, có header):
 *   A: Họ và tên  |  B: Số điện thoại  |  C: Chức vụ (job_role enum value)
 *
 * Email tạm tự sinh: {sdt_clean}@{tenant_slug}.gempm.vn
 * Password tạm: random 10 ký tự — hiển thị để admin copy
 *
 * Phụ thuộc ESMS (SMS OTP lần đầu login) — build xong, enable khi có ESMS account.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useNotification } from './NotificationEngine';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2,
  Download, X, Users, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getSupabase, JOB_LABELS, JOB_TO_TIER, type JobRole, type UserProfile } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BulkRow {
  idx: number;
  full_name: string;
  phone: string;
  job_role: JobRole;
  email: string;        // tự sinh từ SĐT + tenant slug
  password: string;     // random — admin copy gửi cho NV
  error?: string;       // validation error
}

type UploadStatus = 'idle' | 'parsing' | 'preview' | 'uploading' | 'done';

interface BulkResult {
  email: string;
  full_name: string;
  ok: boolean;
  error?: string;
}

interface BulkUserUploadProps {
  tenantSlug: string;
  tenantId: string;
  projects?: { id: string; name: string }[];
  currentUser: UserProfile;
  onDone?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const VALID_ROLES = new Set<string>([
  'giam_doc','pm','ke_toan_truong',
  'truong_qs','truong_qaqc','truong_hse','hr_truong',
  'chi_huy_truong','chi_huy_pho',
  'qs_site','qaqc_site','ks_giam_sat','hse_site','ke_toan_site','ke_toan_kho','hr_site',
  'thu_kho','thu_ky_site','operator','ntp_site','to_doi','ky_thuat_vien',
]);

// Map tên tiếng Việt phổ biến → job_role enum (để user không cần nhớ enum)
const ROLE_ALIAS: Record<string, JobRole> = {
  'giám đốc': 'giam_doc', 'giam doc': 'giam_doc',
  'project manager': 'pm', 'quản lý dự án': 'pm',
  'kế toán trưởng': 'ke_toan_truong', 'ke toan truong': 'ke_toan_truong',
  'trưởng qs': 'truong_qs', 'truong qs': 'truong_qs',
  'trưởng qaqc': 'truong_qaqc', 'trưởng qa/qc': 'truong_qaqc',
  'trưởng hse': 'truong_hse',
  'trưởng hr': 'hr_truong', 'hr trưởng': 'hr_truong',
  'chỉ huy trưởng': 'chi_huy_truong', 'chi huy truong': 'chi_huy_truong',
  'chỉ huy phó': 'chi_huy_pho',
  'qs site': 'qs_site', 'qs công trường': 'qs_site',
  'qa/qc site': 'qaqc_site', 'qaqc site': 'qaqc_site',
  'kỹ sư giám sát': 'ks_giam_sat', 'ks giam sat': 'ks_giam_sat', 'tvgs': 'ks_giam_sat',
  'hse site': 'hse_site',
  'kế toán site': 'ke_toan_site',
  'kế toán kho': 'ke_toan_kho',
  'hr site': 'hr_site', 'nhân sự site': 'hr_site',
  'thủ kho': 'thu_kho',
  'thư ký': 'thu_ky_site', 'thu ky': 'thu_ky_site',
  'operator': 'operator', 'vận hành': 'operator',
  'nhà thầu phụ': 'ntp_site', 'ntp': 'ntp_site',
  'tổ đội': 'to_doi', 'to doi': 'to_doi',
  'kỹ thuật viên': 'ky_thuat_vien', 'ky thuat vien': 'ky_thuat_vien',
};

function parseRole(raw: string): JobRole | null {
  const clean = raw.trim().toLowerCase();
  if (VALID_ROLES.has(clean)) return clean as JobRole;
  if (ROLE_ALIAS[clean]) return ROLE_ALIAS[clean];
  return null;
}

function cleanPhone(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^84/, '0');
}

function phoneToEmail(phone: string, slug: string): string {
  const clean = cleanPhone(phone);
  return `${clean}@${slug}.gempm.vn`;
}

function randomPwd(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function validatePhone(phone: string): boolean {
  const clean = cleanPhone(phone);
  return /^0[3-9]\d{8}$/.test(clean);
}

// ─── Excel parser (dùng SheetJS từ CDN nếu có, fallback CSV parse) ─────────
async function parseExcelFile(file: File): Promise<{ rows: string[][]; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Nếu là CSV
        if (file.name.endsWith('.csv')) {
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          const rows = text.split('\n')
            .map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
            .filter(row => row.some(cell => cell.length > 0));
          resolve({ rows });
          return;
        }
        // Excel: dùng SheetJS nếu available
        const XLSX = (window as any).XLSX;
        if (XLSX) {
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          resolve({ rows });
        } else {
          resolve({ rows: [], error: 'Vui lòng dùng file CSV hoặc cài SheetJS.' });
        }
      } catch (err: any) {
        resolve({ rows: [], error: err.message });
      }
    };
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

// ─── Download Excel template ──────────────────────────────────────────────
function downloadTemplate() {
  const csv = [
    'Họ và tên,Số điện thoại,Chức vụ',
    'Nguyễn Văn An,0901234567,giam_doc',
    'Trần Thị Bình,0912345678,chi_huy_truong',
    'Lê Văn Cường,0923456789,qs_site',
    'Phạm Thị Dung,0934567890,ke_toan_site',
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'GEM_PM_template_nhan_su.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Role reference table ─────────────────────────────────────────────────
const ROLE_REFERENCE: { group: string; roles: JobRole[] }[] = [
  { group: 'Lãnh đạo', roles: ['giam_doc', 'pm', 'ke_toan_truong'] },
  { group: 'Quản lý HO', roles: ['truong_qs', 'truong_qaqc', 'truong_hse', 'hr_truong'] },
  { group: 'Quản lý site', roles: ['chi_huy_truong', 'chi_huy_pho'] },
  { group: 'Kỹ thuật L2', roles: ['qs_site', 'qaqc_site', 'ks_giam_sat', 'hse_site', 'ke_toan_site', 'ke_toan_kho', 'hr_site'] },
  { group: 'Thực địa L1', roles: ['thu_kho', 'thu_ky_site', 'operator', 'ntp_site', 'to_doi', 'ky_thuat_vien'] },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BulkUserUpload({
  tenantSlug, tenantId, projects = [], currentUser, onDone,
}: BulkUserUploadProps) {
  const { ok: notifOk, err: notifErr } = useNotification();
  const sb = getSupabase();

  const [status, setStatus]     = useState<UploadStatus>('idle');
  const [rows, setRows]         = useState<BulkRow[]>([]);
  const [results, setResults]   = useState<BulkResult[]>([]);
  const [showPwd, setShowPwd]   = useState(false);
  const [showRef, setShowRef]   = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows   = rows.filter(r => !r.error);
  const invalidRows = rows.filter(r => r.error);
  const successCount = results.filter(r => r.ok).length;
  const failCount    = results.filter(r => !r.ok).length;

  // ── Parse file ─────────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      notifErr('Chỉ hỗ trợ file .csv hoặc .xlsx');
      return;
    }
    setStatus('parsing');
    const { rows: rawRows, error } = await parseExcelFile(file);
    if (error) { notifErr('Lỗi đọc file: ' + error); setStatus('idle'); return; }

    // Bỏ qua header row (dòng đầu nếu không phải số điện thoại)
    const dataRows = rawRows.filter((r, i) => {
      if (i === 0 && !validatePhone(r[1] ?? '')) return false; // skip header
      return r[0]?.trim() || r[1]?.trim();
    });

    const parsed: BulkRow[] = dataRows.map((r, i) => {
      const full_name = (r[0] ?? '').trim();
      const phone     = (r[1] ?? '').trim();
      const roleRaw   = (r[2] ?? '').trim();
      const job_role  = parseRole(roleRaw);

      let rowError: string | undefined;
      if (!full_name) rowError = 'Thiếu họ tên';
      else if (!phone || !validatePhone(phone)) rowError = 'SĐT không hợp lệ';
      else if (!job_role) rowError = `Chức vụ "${roleRaw}" không hợp lệ`;

      return {
        idx: i + 1,
        full_name,
        phone: cleanPhone(phone),
        job_role: (job_role ?? 'ky_thuat_vien') as JobRole,
        email: phoneToEmail(phone, tenantSlug),
        password: randomPwd(),
        error: rowError,
      };
    });

    setRows(parsed);
    setStatus('preview');
  }, [tenantSlug, notifErr]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!sb || validRows.length === 0) return;
    setStatus('uploading');

    const { data: { session } } = await sb.auth.getSession();
    if (!session) { notifErr('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'); setStatus('preview'); return; }

    const payload = validRows.map(r => ({
      email:      r.email,
      phone:      r.phone,
      full_name:  r.full_name,
      job_role:   r.job_role,
      tier:       JOB_TO_TIER[r.job_role],
      password:   r.password,
      tenant_id:  tenantId,
    }));

    try {
      const res = await fetch(
        `${(import.meta as any).env?.VITE_SUPABASE_URL}/functions/v1/bulk-create-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': (import.meta as any).env?.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ users: payload }),
        }
      );
      const data = await res.json();
      if (!res.ok) { notifErr(data.error ?? 'Lỗi tạo users'); setStatus('preview'); return; }
      setResults(data.results ?? []);
      setStatus('done');
      notifOk(`Tạo xong ${data.results?.filter((r: BulkResult) => r.ok).length ?? 0} tài khoản`);
    } catch (e: any) {
      notifErr('Lỗi kết nối: ' + e.message);
      setStatus('preview');
    }
  };

  const reset = () => {
    setStatus('idle');
    setRows([]);
    setResults([]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Tạo tài khoản hàng loạt</h2>
          <p className="text-xs text-slate-500 mt-0.5">Upload danh sách nhân sự từ file Excel / CSV</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRef(v => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-violet-300 transition-colors"
          >
            Bảng chức vụ {showRef ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 px-3 py-1.5 rounded-lg border border-violet-200 hover:border-violet-400 transition-colors"
          >
            <Download size={13}/> Tải template
          </button>
        </div>
      </div>

      {/* Role reference */}
      {showRef && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Mã chức vụ hợp lệ (cột C trong file)</p>
          <div className="grid grid-cols-2 gap-3">
            {ROLE_REFERENCE.map(g => (
              <div key={g.group}>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">{g.group}</p>
                <div className="space-y-0.5">
                  {g.roles.map(r => (
                    <div key={r} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{JOB_LABELS[r]}</span>
                      <code className="text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-[10px]">{r}</code>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── IDLE: Drop zone ── */}
      {status === 'idle' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-violet-400 bg-violet-50'
              : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
          }`}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput}/>
          <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet size={28} className="text-violet-500"/>
          </div>
          <p className="font-semibold text-slate-700 mb-1">Kéo thả file hoặc click để chọn</p>
          <p className="text-xs text-slate-400">Hỗ trợ .csv · .xlsx · .xls</p>
          <p className="text-xs text-slate-400 mt-1">Cột A: Họ tên · Cột B: SĐT · Cột C: Chức vụ</p>
        </div>
      )}

      {/* ── PARSING ── */}
      {status === 'parsing' && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
          <Loader2 size={20} className="animate-spin text-violet-500"/>
          <span className="text-sm">Đang đọc file...</span>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {status === 'preview' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 size={14}/>
              <span className="font-semibold">{validRows.length}</span> hợp lệ
            </div>
            {invalidRows.length > 0 && (
              <div className="flex items-center gap-2 text-sm bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-200">
                <AlertCircle size={14}/>
                <span className="font-semibold">{invalidRows.length}</span> lỗi (sẽ bỏ qua)
              </div>
            )}
            <button
              onClick={() => setShowPwd(v => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 ml-auto"
            >
              {showPwd ? <EyeOff size={13}/> : <Eye size={13}/>}
              {showPwd ? 'Ẩn' : 'Hiện'} mật khẩu tạm
            </button>
            <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <X size={13}/> Chọn lại
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 w-8">#</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Họ tên</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500">SĐT</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Chức vụ</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Email tạm</th>
                    {showPwd && <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Mật khẩu tạm</th>}
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 w-24">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => (
                    <tr key={r.idx} className={r.error ? 'bg-rose-50' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-slate-400">{r.idx}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{r.full_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.phone || '—'}</td>
                      <td className="px-3 py-2">
                        {r.error
                          ? <span className="text-rose-500">{r.job_role}</span>
                          : <span className="text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{r.job_role}</span>
                        }
                      </td>
                      <td className="px-3 py-2 text-slate-500 font-mono">{r.error ? '—' : r.email}</td>
                      {showPwd && (
                        <td className="px-3 py-2 font-mono text-amber-700">{r.error ? '—' : r.password}</td>
                      )}
                      <td className="px-3 py-2">
                        {r.error
                          ? <span className="text-rose-500 flex items-center gap-1"><AlertCircle size={11}/>{r.error}</span>
                          : <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={11}/>OK</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Note về email/password */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">Lưu ý trước khi tạo:</p>
            <p>• Email tạm dạng <code className="bg-amber-100 px-1 rounded">{`{sdt}@${tenantSlug}.gempm.vn`}</code> — chỉ dùng để đăng nhập nội bộ</p>
            <p>• Nhân viên sẽ đăng nhập bằng <strong>số điện thoại + OTP</strong> khi ESMS được kích hoạt</p>
            <p>• Mật khẩu tạm: admin copy gửi trực tiếp cho nhân viên qua Zalo/SMS</p>
          </div>

          {/* Actions */}
          {validRows.length > 0 && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={reset} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                Hủy
              </button>
              <button
                onClick={handleUpload}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Users size={15}/>
                Tạo {validRows.length} tài khoản
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOADING ── */}
      {status === 'uploading' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 size={32} className="animate-spin text-violet-500"/>
          <div className="text-center">
            <p className="font-semibold text-slate-700">Đang tạo tài khoản...</p>
            <p className="text-xs text-slate-400 mt-1">{validRows.length} tài khoản · vui lòng không đóng trang</p>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {status === 'done' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={20} className="text-white"/>
            </div>
            <div>
              <p className="font-bold text-emerald-800">Hoàn tất!</p>
              <p className="text-sm text-emerald-700">
                <span className="font-semibold">{successCount}</span> tài khoản tạo thành công
                {failCount > 0 && <span className="text-rose-600 ml-2">· {failCount} lỗi</span>}
              </p>
            </div>
          </div>

          {/* Results table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Họ tên</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Email</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 w-24">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, i) => (
                    <tr key={i} className={r.ok ? '' : 'bg-rose-50'}>
                      <td className="px-3 py-2 font-medium text-slate-800">{r.full_name}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono">{r.email}</td>
                      <td className="px-3 py-2">
                        {r.ok
                          ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={11}/>Thành công</span>
                          : <span className="text-rose-500 flex items-center gap-1"><AlertCircle size={11}/>{r.error}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
            >
              <RefreshCw size={13}/> Upload thêm
            </button>
            {onDone && (
              <button
                onClick={onDone}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Xong
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
