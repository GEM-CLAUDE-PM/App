/**
 * AdminPanel.tsx — GEM&CLAUDE PM Pro
 * Trang quản trị: tạo user, gán role, gán project.
 * Chỉ hiển thị với tier = 'admin' (Giám đốc DA).
 *
 * Khi VITE_USE_SUPABASE=true: gọi Supabase Auth Admin API qua service role
 * Khi dev mode: hiển thị danh sách MOCK_USERS để tham khảo
 */

import React, { useState, useEffect, useCallback } from 'react';
import ModalForm, { BtnCancel, BtnSubmit } from './ModalForm';
import {
  Users, UserPlus, Trash2, Edit3, Save, X, Shield,
  Building2, ChevronDown, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, Key, Mail, Phone, Lock,
  Eye, EyeOff, Copy, Check,
} from 'lucide-react';
import { getSupabase, JOB_LABELS, TIER_LABELS, TIER_COLORS, JOB_TO_TIER, JOB_ROLE_TO_ROLE_ID,
  type UserProfile, type JobRole, type TierRole } from './supabase';
import { mockProjects } from '../constants/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NewUserForm {
  email: string;
  full_name: string;
  phone: string;
  job_role: JobRole;
  project_ids: string[];
  password: string;
}

const EMPTY_FORM: NewUserForm = {
  email: '', full_name: '', phone: '',
  job_role: 'chi_huy_truong',
  project_ids: [],
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
}

export default function AdminPanel({ currentUserId, onClose }: AdminPanelProps) {
  const isDevMode = (import.meta as any).env?.VITE_USE_SUPABASE !== 'true';
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Load users ──────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    if (isDevMode || !sb) {
      // Dev mode: hiển thị mock users
      const { MOCK_USERS } = await import('./supabase');
      setUsers(MOCK_USERS as UserProfile[]);
      setLoading(false);
      return;
    }
    const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) showToast('err', 'Không tải được danh sách user: ' + error.message);
    else setUsers(data ?? []);
    setLoading(false);
  }, [isDevMode, sb]);

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

    if (isDevMode || !sb) {
      // Dev mode: chỉ hiển thị thông báo
      showToast('ok', isDevMode
        ? `[Dev mode] User "${form.full_name}" sẽ được tạo khi kết nối Supabase thật.`
        : 'Đã lưu (mock).');
      setSaving(false);
      setShowForm(false);
      return;
    }

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
    if (isDevMode || !sb) {
      showToast('ok', `[Dev mode] User "${name}" sẽ bị xóa khi kết nối Supabase thật.`);
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
  const toggleProject = (pid: string) => {
    setForm(f => ({
      ...f,
      project_ids: f.project_ids.includes(pid)
        ? f.project_ids.filter(p => p !== pid)
        : [...f.project_ids, pid],
    }));
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  // Roles hiển thị trong AdminPanel — chỉ nội bộ, không có external portal
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
          {isDevMode && (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-full font-medium">
              Dev Mode — chưa kết nối Supabase thật
            </span>
          )}
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

        {/* ── Dev mode notice ── */}
        {isDevMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5"/>
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">App đang chạy ở chế độ Local (Dev Mode)</p>
              <p>Để tạo user thật, cần bật Supabase trong <code className="bg-amber-100 px-1 rounded">.env</code>:</p>
              <code className="block mt-1 bg-amber-100 px-2 py-1 rounded text-xs">VITE_USE_SUPABASE=true</code>
              <p className="mt-1">Danh sách bên dưới là user mẫu để tham khảo giao diện.</p>
            </div>
          </div>
        )}

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
                                const proj = mockProjects.find(p => p.id === pid);
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

              {/* Gán dự án */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">
                  Gán dự án <span className="font-normal text-slate-400">(có thể chọn nhiều)</span>
                </label>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {mockProjects.map(p => {
                    const checked = form.project_ids.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-violet-50 border-violet-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProject(p.id)}
                          className="accent-violet-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                          <p className="text-[11px] text-slate-400">{p.status === 'in_progress' ? '🟢 Đang thi công' : '⚪ Tạm dừng'}</p>
                        </div>
                        {checked && <CheckCircle2 size={15} className="text-violet-500 flex-shrink-0"/>}
                      </label>
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
