/**
 * AdminPanel.tsx — GEM&CLAUDE PM Pro
 * Trang quản trị: tạo user, gán role, gán project.
 * Chỉ hiển thị với tier = 'admin' (Giám đốc DA).
 *
 * Khi VITE_USE_SUPABASE=true: gọi Supabase Auth Admin API qua service role
 * Quản lý users — tạo, sửa, xóa, gán role và dự án
 */

import React, { useState, useEffect, useCallback } from 'react';
import ModalForm, { BtnCancel, BtnSubmit } from './ModalForm';
import {
  Users, UserPlus, Trash2, Edit3, Save, X, Shield, ShieldCheck,
  Building2, ChevronDown, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, Key, Mail, Phone, Lock,
  Eye, EyeOff, Copy, Check,
} from 'lucide-react';
import { getSupabase, JOB_LABELS, TIER_LABELS, TIER_COLORS, JOB_TO_TIER, JOB_ROLE_TO_ROLE_ID,
  type UserProfile, type JobRole, type TierRole } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
// project_roles: { [projectId]: string[] } — roles của user trong từng DA
interface ProjectRoleAssignment {
  projectId: string;
  roles: JobRole[]; // union roles trong DA này
}

interface NewUserForm {
  email: string;
  full_name: string;
  phone: string;
  job_role: JobRole;           // role chính (scope HO / all-projects)
  project_ids: string[];       // legacy — derived từ projectRoles
  project_roles: ProjectRoleAssignment[]; // roles theo từng DA
  password: string;
}

const EMPTY_FORM: NewUserForm = {
  email: '', full_name: '', phone: '',
  job_role: 'chi_huy_truong',
  project_ids: [],
  project_roles: [],
  password: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Component ────────────────────────────────────────────────────────────────
interface AdminPanelProps {
  currentUserId: string;
  onClose?: () => void;
  projects?: any[];
}

export default function AdminPanel({ currentUserId, onClose, projects = [] }: AdminPanelProps) {
  const sb = getSupabase();

  const [users, setUsers]           = useState<UserProfile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [editUser, setEditUser]     = useState<UserProfile | null>(null);
  const [form, setForm]             = useState<NewUserForm>(EMPTY_FORM);
  const [showPwd, setShowPwd]       = useState(false);
  const [copiedPwd, setCopiedPwd]   = useState(false);
  const [deleteConfirm, setDeleteConfirm]     = useState<string | null>(null);
  const [transferConfirm, setTransferConfirm] = useState<string | null>(null);

  // L4/L5 roles có thể làm tenant admin
  const ADMIN_ELIGIBLE_ROLES: JobRole[] = ['giam_doc', 'pm', 'ke_toan_truong'];

  const handleTransferAdmin = async (toUserId: string, toUserName: string) => {
    if (!sb) { showToast('err', 'Chỉ khả dụng khi kết nối Supabase.'); return; }
    setSaving(true);
    const { error } = await sb.rpc('transfer_tenant_admin', { new_admin_user_id: toUserId });
    setSaving(false);
    setTransferConfirm(null);
    if (error) { showToast('err', 'Lỗi chuyển giao: ' + error.message); return; }
    showToast('ok', `Đã chuyển quyền Admin cho "${toUserName}".`);
    await loadUsers();
  };

  // ── Load users ──────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    if (!sb) { showToast('err', 'Không thể kết nối máy chủ.'); setLoading(false); return; }
    const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) showToast('err', 'Không tải được danh sách user: ' + error.message);
    else setUsers(data ?? []);
    setLoading(false);
  }, [sb]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Open create form ────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditUser(null);
    setForm({ ...EMPTY_FORM, password: randomPassword() });
    setShowForm(true);
  };

  // ── Open edit form ──────────────────────────────────────────────────────────
  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setForm({
      email: u.email,
      full_name: u.full_name,
      phone: u.phone ?? '',
      job_role: u.job_role,
      // Khi edit: reconstruct project_roles từ project_ids + job_role chính
      // (sẽ được cải thiện khi có DB thực — hiện tại assign role chính cho tất cả DA)
      project_roles: (u.project_ids ?? []).map(pid => ({
        projectId: pid,
        roles: [u.job_role as JobRole],
      })),
      project_ids: u.project_ids ?? [],
      password: '',
    });
    setShowForm(true);
  };

  // ── Save (create or update) ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.email || !form.full_name) {
      showToast('err', 'Vui lòng điền đầy đủ Email và Họ tên.'); return;
    }
    if (!editUser && !form.password) {
      showToast('err', 'Vui lòng nhập mật khẩu cho user mới.'); return;
    }

    setSaving(true);
    const tier = JOB_TO_TIER[form.job_role];

    if (!sb) { showToast('err', 'Không thể kết nối máy chủ.'); setSaving(false); return; }

    if (editUser) {
      // UPDATE profile
      const { error } = await sb.from('profiles').update({
        full_name: form.full_name,
        phone: form.phone || null,
        job_role: form.job_role,
        tier,
        project_ids: form.project_ids,
      }).eq('id', editUser.id);

      if (error) showToast('err', 'Lỗi cập nhật: ' + error.message);
      else { showToast('ok', `Đã cập nhật "${form.full_name}".`); await loadUsers(); }
    } else {
      // CREATE — gọi Edge Function invite-member (dùng service_role key an toàn ở server)
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email:       form.email,
            full_name:   form.full_name,
            job_role:    form.job_role,
            tier,
            phone:       form.phone || null,
            project_ids: form.project_ids,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok || result.error) {
        showToast('err', result.error || 'Lỗi mời thành viên');
      } else {
        showToast('ok', `Đã gửi email mời đến ${form.email}. Họ sẽ nhận link để vào app.`);
        await loadUsers();
      }
    }

    setSaving(false);
    setShowForm(false);
  };

  // ── Delete user ─────────────────────────────────────────────────────────────
  const handleDelete = async (uid: string, name: string) => {
    if (uid === currentUserId) {
      showToast('err', 'Không thể xóa chính mình.'); return;
    }
    if (!sb) { showToast('err', 'Không thể kết nối máy chủ.'); return; }
    if (false) {
      setDeleteConfirm(null); return;
    }
    // Xóa profile (auth user cần xóa từ Supabase Dashboard hoặc Edge Function)
    const { error } = await sb.from('profiles').delete().eq('id', uid);
    if (error) showToast('err', 'Lỗi xóa: ' + error.message);
    else { showToast('ok', `Đã xóa "${name}".`); await loadUsers(); }
    setDeleteConfirm(null);
  };

  // ── Copy password ────────────────────────────────────────────────────────────
  const copyPwd = () => {
    navigator.clipboard.writeText(form.password).then(() => {
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
    });
  };

  // ── Toggle project ────────────────────────────────────────────────────────────
  // ─── Render ───────────────────────────────────────────────────────────────
  // Toggle role trong 1 project cụ thể
  const toggleProjectRole = (projectId: string, role: JobRole) => {
    setForm(f => {
      const existing = f.project_roles.find(pr => pr.projectId === projectId);
      if (!existing) {
        // Thêm project với role đầu tiên — cũng thêm vào project_ids
        return {
          ...f,
          project_roles: [...f.project_roles, { projectId, roles: [role] }],
          project_ids: f.project_ids.includes(projectId) ? f.project_ids : [...f.project_ids, projectId],
        };
      }
      const hasRole = existing.roles.includes(role);
      const newRoles = hasRole
        ? existing.roles.filter(r => r !== role)
        : [...existing.roles, role];
      const newProjectRoles = newRoles.length === 0
        ? f.project_roles.filter(pr => pr.projectId !== projectId)
        : f.project_roles.map(pr => pr.projectId === projectId ? { ...pr, roles: newRoles } : pr);
      // Sync project_ids
      const newProjectIds = newProjectRoles.map(pr => pr.projectId);
      return { ...f, project_roles: newProjectRoles, project_ids: newProjectIds };
    });
  };

  const getProjectRoles = (projectId: string): JobRole[] =>
    form.project_roles.find(pr => pr.projectId === projectId)?.roles ?? [];

  const ROLE_GROUPS: { label: string; roles: JobRole[] }[] = [
    { label: 'Lãnh đạo', roles: ['giam_doc', 'pm', 'ke_toan_truong'] },
    { label: 'Quản lý HO (nhiều dự án)', roles: ['truong_qs', 'truong_qaqc', 'truong_hse', 'hr_truong'] },
    { label: 'Quản lý site', roles: ['chi_huy_truong', 'chi_huy_pho'] },
    { label: 'Kỹ thuật site (L2)', roles: ['qs_site', 'qaqc_site', 'ks_giam_sat', 'hse_site', 'ke_toan_site', 'ke_toan_kho', 'hr_site'] },
    { label: 'Thực địa (L1)', roles: ['thu_kho', 'thu_ky_site', 'operator'] },
    { label: 'Nhân công / Nhà thầu (L1 — app rút gọn)', roles: ['ntp_site', 'to_doi', 'ky_thuat_vien'] },
  ];
  const jobRoles = ROLE_GROUPS.flatMap(g => g.roles);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Quản lý Người dùng</h1>
            <p className="text-xs text-slate-500">Tạo tài khoản, gán chức vụ và dự án</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadUsers} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Tải lại">
            <RefreshCw size={16} className="text-slate-500"/>
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={16} className="text-slate-500"/>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* ── Action bar ── */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{users.length}</span> tài khoản
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <UserPlus size={15}/> Thêm người dùng
          </button>
        </div>

        {/* ── User list ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-violet-500"/>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Họ tên</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Chức vụ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phân cấp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dự án</th>
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => {
                  const tc = TIER_COLORS[u.tier as TierRole] ?? TIER_COLORS.worker;
                  const isMe = u.id === currentUserId;
                  return (
                    <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${isMe ? 'bg-violet-50/40' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {u.full_name.split(' ').pop()?.charAt(0) ?? '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {u.full_name}
                              {isMe && <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-medium">Bạn</span>}
                            </p>
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <Mail size={10}/> {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {JOB_LABELS[u.job_role as JobRole] ?? u.job_role}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tc.bg} ${tc.text} ${tc.border}`}>
                          {TIER_LABELS[u.tier as TierRole] ?? u.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(u.project_ids ?? []).length === 0
                            ? <span className="text-xs text-slate-400">Chưa gán</span>
                            : (u.project_ids ?? []).slice(0, 3).map(pid => {
                                const proj = (projects || []).find((p:any) => p.id === pid);
                                return (
                                  <span key={pid} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">
                                    {proj?.name?.split(' ').slice(-2).join(' ') ?? pid}
                                  </span>
                                );
                              })
                          }
                          {(u.project_ids ?? []).length > 3 && (
                            <span className="text-[10px] text-slate-400">+{(u.project_ids ?? []).length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-blue-500"
                            title="Chỉnh sửa"
                          >
                            <Edit3 size={14}/>
                          </button>
                          {/* Transfer Admin — chỉ hiện với L4/L5, không phải mình, không phải admin hiện tại */}
                          {!isMe && ADMIN_ELIGIBLE_ROLES.includes(u.job_role as JobRole) && !(u as any).is_tenant_admin && (
                            transferConfirm === u.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-amber-600 font-medium">Chuyển Admin?</span>
                                <button
                                  onClick={() => handleTransferAdmin(u.id, u.full_name)}
                                  disabled={saving}
                                  className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-medium hover:bg-amber-600 disabled:opacity-50"
                                >Xác nhận</button>
                                <button
                                  onClick={() => setTransferConfirm(null)}
                                  className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium hover:bg-slate-300"
                                >Hủy</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setTransferConfirm(u.id)}
                                className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors text-slate-400 hover:text-amber-500"
                                title="Chuyển quyền Admin cho người này"
                              >
                                <ShieldCheck size={14}/>
                              </button>
                            )
                          )}
                          {!isMe && (
                            deleteConfirm === u.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-red-600 font-medium">Xác nhận?</span>
                                <button
                                  onClick={() => handleDelete(u.id, u.full_name)}
                                  className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-medium hover:bg-red-600"
                                >Xóa</button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium hover:bg-slate-300"
                                >Hủy</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(u.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500"
                                title="Xóa user"
                              >
                                <Trash2 size={14}/>
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Form Modal ── */}
      <ModalForm
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
        subtitle={editUser ? 'Cập nhật thông tin tài khoản' : 'Tạo tài khoản và gán dự án'}
        icon={<UserPlus size={18}/>}
        color="violet"
        width="md"
        loading={saving}
        footer={<>
          <BtnCancel onClick={() => setShowForm(false)}/>
          <BtnSubmit
            label={editUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            loading={saving}
            onClick={handleSave}
          />
        </>}
      >
        <div className="space-y-4">

              {/* Họ tên */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Họ và tên *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="VD: Nguyễn Văn An"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    disabled={!!editUser}
                    placeholder="email@congty.vn"
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                {editUser && <p className="text-[11px] text-slate-400 mt-1">Email không thể thay đổi sau khi tạo.</p>}
              </div>

              {/* Số điện thoại */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số điện thoại</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="0901 234 567"
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              </div>

              {/* Chức vụ */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Chức vụ *</label>
                <div className="relative">
                  <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <select
                    value={form.job_role}
                    onChange={e => setForm(f => ({ ...f, job_role: e.target.value as JobRole }))}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    {ROLE_GROUPS.map(grp => (
                      <optgroup key={grp.label} label={grp.label}>
                        {grp.roles.map(r => (
                          <option key={r} value={r}>{JOB_LABELS[r]}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Phân cấp tự động: <span className="font-medium">{TIER_LABELS[JOB_TO_TIER[form.job_role]]}</span>
                </p>
              </div>

              {/* Mật khẩu (chỉ khi tạo mới) */}
              {!editUser && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mật khẩu tạm *</label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-20 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button type="button" onClick={copyPwd} className="p-1 hover:bg-slate-100 rounded text-slate-400" title="Copy">
                        {copiedPwd ? <Check size={13} className="text-green-500"/> : <Copy size={13}/>}
                      </button>
                      <button type="button" onClick={() => setShowPwd(v => !v)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                        {showPwd ? <EyeOff size={13}/> : <Eye size={13}/>}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-slate-400">Người dùng nên đổi mật khẩu sau lần đăng nhập đầu tiên.</p>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, password: randomPassword() }))}
                      className="text-[11px] text-violet-600 hover:underline"
                    >Tạo ngẫu nhiên</button>
                  </div>
                </div>
              )}

              {/* Gán dự án + roles trong từng DA */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Gán dự án & phân quyền theo DA
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  1 user có thể kiêm nhiều roles trong cùng 1 dự án — quyền = union của tất cả roles.
                </p>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {(projects || []).map((p:any) => {
                    const assignedRoles = getProjectRoles(p.id);
                    const isAssigned = assignedRoles.length > 0;
                    // Roles phù hợp với scope DA (site roles + cross roles)
                    const SITE_ROLE_GROUPS = [
                      { label: 'Quản lý site', roles: ['chi_huy_truong','chi_huy_pho'] as JobRole[] },
                      { label: 'Kỹ thuật', roles: ['ks_giam_sat','qs_site','qaqc_site','hse_site'] as JobRole[] },
                      { label: 'Kế toán / Kho', roles: ['ke_toan_site','ke_toan_kho','thu_kho'] as JobRole[] },
                      { label: 'Nhân sự / Hành chính', roles: ['hr_site','thu_ky_site','operator'] as JobRole[] },
                      { label: 'HO (tất cả DA)', roles: ['giam_doc','pm','ke_toan_truong','truong_qs','truong_qaqc','truong_hse','hr_truong'] as JobRole[] },
                    ];
                    return (
                      <div key={p.id} className={`border rounded-2xl overflow-hidden transition-colors ${isAssigned ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200 bg-white'}`}>
                        {/* Project header */}
                        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
                          <Building2 size={13} className="text-slate-400 shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400">{p.status === 'in_progress' ? '🟢 Đang thi công' : '⚪ Tạm dừng'}</p>
                          </div>
                          {isAssigned && (
                            <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full shrink-0">
                              {assignedRoles.length} role
                            </span>
                          )}
                        </div>
                        {/* Role checkboxes per project */}
                        <div className="p-2.5 space-y-2">
                          {SITE_ROLE_GROUPS.map(grp => (
                            <div key={grp.label}>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{grp.label}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {grp.roles.map(role => {
                                  const active = assignedRoles.includes(role);
                                  return (
                                    <button
                                      key={role}
                                      type="button"
                                      onClick={() => toggleProjectRole(p.id, role)}
                                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                                        active
                                          ? 'bg-violet-600 text-white border-violet-600'
                                          : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-700'
                                      }`}
                                    >
                                      {JOB_LABELS[role] ?? role}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
        </div>
      </ModalForm>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'ok'
            ? 'bg-emerald-500 text-white'
            : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'ok'
            ? <CheckCircle2 size={16}/>
            : <AlertCircle size={16}/>
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}
