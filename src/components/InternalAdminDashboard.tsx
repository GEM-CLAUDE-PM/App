/**
 * InternalAdminDashboard.tsx — GEM & CLAUDE PM Pro
 * S17 — Dashboard nội bộ cho GEM&CLAUDE team
 * Tenant list, usage stats, trial management, plan override
 *
 * CHỈ hiển thị với superadmin (email @gemclaudepm.com hoặc env flag)
 * Route: activeTab === 'internal_admin' trong App.tsx (ẩn với user thường)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from './NotificationEngine';
import { getSupabase, type PlanId, type TenantRecord } from './supabase';
import ModalForm, { FormRow, FormGrid, FormSection, inputCls, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import {
  Building2, Users, Shield, Crown, Zap, AlertTriangle,
  RefreshCw, Search, CheckCircle2, XCircle, Calendar,
  TrendingUp, Activity, Lock, Unlock, Edit3, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TenantRow extends TenantRecord {
  user_count:    number;
  project_count: number;
  admin_email:   string;
  admin_name:    string;
  days_left:     number | null;  // null = không phải trial
  plan_id:       PlanId;         // alias cho plan — backward compat
  is_active:     boolean;        // alias cho !is_locked
}

interface OverrideForm {
  plan_id:       PlanId;
  trial_ends_at: string;  // ISO date string
  is_active:     boolean;
  note:          string;
}

const PLAN_COLORS: Record<PlanId, string> = {
  trial:      'bg-amber-100 text-amber-700',
  starter:    'bg-slate-100 text-slate-700',
  pro:        'bg-emerald-100 text-emerald-700',
  enterprise: 'bg-violet-100 text-violet-700',
};
const PLAN_ICONS: Record<PlanId, React.ReactNode> = {
  trial:      <Zap size={11}/>,
  starter:    <Shield size={11}/>,
  pro:        <CheckCircle2 size={11}/>,
  enterprise: <Crown size={11}/>,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function InternalAdminDashboard() {
  const { ok, err, warn } = useNotification();

  const [tenants, setTenants]         = useState<TenantRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [planFilter, setPlanFilter]   = useState<PlanId | 'all'>('all');
  const [sortBy, setSortBy]           = useState<'created_at' | 'user_count' | 'days_left'>('created_at');
  const [sortAsc, setSortAsc]         = useState(false);

  const [showOverride, setShowOverride]     = useState(false);
  const [targetTenant, setTargetTenant]     = useState<TenantRow | null>(null);
  const [overrideForm, setOverrideForm]     = useState<OverrideForm>({
    plan_id: 'trial', trial_ends_at: '', is_active: true, note: '',
  });
  const [saving, setSaving] = useState(false);

  // ─── Load tenants ─────────────────────────────────────────────────────────
  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const sb = getSupabase();
      if (!sb) { warn('Cần kết nối Supabase để xem Internal Admin.'); return; }

      // Join tenants + profiles (admin) + đếm users + projects
      const { data, error } = await sb
        .from('tenants')
        .select(`
          *,
          profiles!inner(
            id, email, full_name,
            is_tenant_admin
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      // Lấy project count từ projects table theo tenant
      const { data: projectCounts } = await sb
        .from('projects')
        .select('tenant_id')
        .not('tenant_id', 'is', null);

      const pcMap: Record<string, number> = {};
      (projectCounts ?? []).forEach((r: any) => {
        pcMap[r.tenant_id] = (pcMap[r.tenant_id] ?? 0) + 1;
      });

      const rows: TenantRow[] = (data ?? []).map((t: any) => {
        const profiles: any[] = t.profiles ?? [];
        const admin = profiles.find((p: any) => p.is_tenant_admin) ?? profiles[0] ?? {};
        const daysLeft = t.trial_ends_at
          ? Math.max(0, Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000))
          : null;
        return {
          id:              t.id,
          name:            t.name,
          slug:            t.slug ?? t.id,
          plan:            t.plan ?? 'trial',
          plan_id:         t.plan ?? 'trial',        // alias
          trial_ends_at:   t.trial_ends_at ?? null,
          plan_expires_at: t.plan_expires_at ?? null,
          is_locked:       !!t.is_locked,
          is_active:       !t.is_locked,              // alias
          stripe_customer_id: t.stripe_customer_id,
          payos_customer_id:  t.payos_customer_id,
          created_at:      t.created_at,
          updated_at:      t.updated_at,
          user_count:      profiles.length,
          project_count:   pcMap[t.id] ?? 0,
          admin_email:     admin.email    ?? '—',
          admin_name:      admin.full_name ?? '—',
          days_left:       daysLeft,
        };
      });
      setTenants(rows);
    } catch (e: any) {
      err(`Lỗi load tenants: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  // ─── Override plan ────────────────────────────────────────────────────────
  const openOverride = (t: TenantRow) => {
    setTargetTenant(t);
    setOverrideForm({
      plan_id:       t.plan_id,
      trial_ends_at: t.trial_ends_at
        ? new Date(t.trial_ends_at).toISOString().slice(0, 10)
        : '',
      is_active:     t.is_active,
      note:          '',
    });
    setShowOverride(true);
  };

  const handleSaveOverride = async () => {
    if (!targetTenant) return;
    setSaving(true);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Không có Supabase');
      const { error } = await sb
        .from('tenants')
        .update({
          plan_id:       overrideForm.plan_id,
          trial_ends_at: overrideForm.trial_ends_at
            ? new Date(overrideForm.trial_ends_at).toISOString()
            : null,
          is_active:     overrideForm.is_active,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', targetTenant.id);
      if (error) throw new Error(error.message);
      ok(`Đã cập nhật tenant "${targetTenant.name}"`);
      setShowOverride(false);
      loadTenants();
    } catch (e: any) {
      err(`Lỗi: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (t: TenantRow) => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb
      .from('tenants')
      .update({ is_active: !t.is_active, updated_at: new Date().toISOString() })
      .eq('id', t.id);
    if (error) { err(error.message); return; }
    ok(`Đã ${t.is_active ? 'khóa' : 'mở khóa'} tenant "${t.name}"`);
    loadTenants();
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const filtered = tenants
    .filter(t =>
      (planFilter === 'all' || t.plan_id === planFilter) &&
      (t.name.toLowerCase().includes(search.toLowerCase()) ||
       t.admin_email.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      let v = 0;
      if (sortBy === 'created_at') v = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'user_count') v = a.user_count - b.user_count;
      if (sortBy === 'days_left')  v = (a.days_left ?? 999) - (b.days_left ?? 999);
      return sortAsc ? v : -v;
    });

  const stats = {
    total:      tenants.length,
    active:     tenants.filter(t => t.is_active).length,
    trial:      tenants.filter(t => t.plan_id === 'trial').length,
    expiringSoon: tenants.filter(t => t.plan_id === 'trial' && (t.days_left ?? 999) <= 3).length,
    paid:       tenants.filter(t => t.plan_id !== 'trial').length,
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(v => !v);
    else { setSortBy(col); setSortAsc(false); }
  };
  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col ? (sortAsc ? <ChevronUp size={11}/> : <ChevronDown size={11}/>) : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Activity size={16} className="text-violet-600"/>
            Internal Admin — Tenant Management
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">GEM&CLAUDE team only · không hiển thị với user thường</p>
        </div>
        <button onClick={loadTenants} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-1.5 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''}/>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Tổng tenant',     value: stats.total,        color: 'text-slate-700',   bg: 'bg-slate-50'  },
          { label: 'Đang active',     value: stats.active,       color: 'text-emerald-700', bg: 'bg-emerald-50'},
          { label: 'Đang trial',      value: stats.trial,        color: 'text-amber-700',   bg: 'bg-amber-50'  },
          { label: 'Sắp hết trial',   value: stats.expiringSoon, color: 'text-red-700',     bg: 'bg-red-50'    },
          { label: 'Đã mua gói',      value: stats.paid,         color: 'text-violet-700',  bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-slate-200 px-4 py-3`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400"/>
          <input
            className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 w-52"
            placeholder="Tên công ty / email..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
          value={planFilter} onChange={e => setPlanFilter(e.target.value as any)}
        >
          <option value="all">Tất cả plan</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Công ty</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin</th>
                <th className="text-center px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan</th>
                <th
                  className="text-center px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600"
                  onClick={() => toggleSort('days_left')}
                >
                  <span className="flex items-center justify-center gap-1">Trial còn <SortIcon col="days_left"/></span>
                </th>
                <th
                  className="text-center px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600"
                  onClick={() => toggleSort('user_count')}
                >
                  <span className="flex items-center justify-center gap-1">Users <SortIcon col="user_count"/></span>
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">DA</th>
                <th className="text-center px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="text-center px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Không có tenant nào.</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800">{t.name}</p>
                    <p className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleDateString('vi-VN')}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-slate-700">{t.admin_name}</p>
                    <p className="text-[10px] text-slate-400">{t.admin_email}</p>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${PLAN_COLORS[t.plan_id]}`}>
                      {PLAN_ICONS[t.plan_id]}{t.plan_id.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {t.days_left !== null ? (
                      <span className={`text-xs font-bold ${
                        t.days_left === 0 ? 'text-red-600' :
                        t.days_left <= 3  ? 'text-amber-600' : 'text-slate-600'
                      }`}>
                        {t.days_left === 0 ? 'HẾT HẠN' : `${t.days_left}d`}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-slate-700">{t.user_count}</td>
                  <td className="px-3 py-3 text-center font-bold text-slate-700">{t.project_count}</td>
                  <td className="px-3 py-3 text-center">
                    {t.is_active
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-bold"><CheckCircle2 size={11}/>Active</span>
                      : <span className="inline-flex items-center gap-1 text-red-500 text-[10px] font-bold"><XCircle size={11}/>Locked</span>
                    }
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openOverride(t)}
                        className="p-1.5 rounded-lg hover:bg-violet-100 text-violet-600 transition-colors" title="Override plan">
                        <Edit3 size={13}/>
                      </button>
                      <button onClick={() => handleToggleActive(t)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          t.is_active
                            ? 'hover:bg-red-100 text-red-500'
                            : 'hover:bg-emerald-100 text-emerald-600'
                        }`} title={t.is_active ? 'Khóa tenant' : 'Mở khóa tenant'}>
                        {t.is_active ? <Lock size={13}/> : <Unlock size={13}/>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Modal */}
      <ModalForm
        open={showOverride}
        onClose={() => setShowOverride(false)}
        title={`Override plan — ${targetTenant?.name ?? ''}`}
        subtitle="Thay đổi plan, trial date, trạng thái tenant"
        icon={<Edit3 size={18}/>}
        color="violet"
        width="md"
        footer={<>
          <BtnCancel onClick={() => setShowOverride(false)}/>
          <BtnSubmit label={saving ? 'Đang lưu...' : 'Lưu thay đổi'} onClick={handleSaveOverride}/>
        </>}
      >
        <FormSection title="Thông tin plan">
          <FormGrid cols={2}>
            <FormRow label="Plan" required>
              <select className={selectCls} value={overrideForm.plan_id}
                onChange={e => setOverrideForm(p => ({ ...p, plan_id: e.target.value as PlanId }))}>
                <option value="trial">Trial</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </FormRow>
            <FormRow label="Trial hết hạn">
              <input type="date" className={inputCls}
                value={overrideForm.trial_ends_at}
                onChange={e => setOverrideForm(p => ({ ...p, trial_ends_at: e.target.value }))}/>
            </FormRow>
            <FormRow label="Trạng thái">
              <select className={selectCls} value={String(overrideForm.is_active)}
                onChange={e => setOverrideForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Locked</option>
              </select>
            </FormRow>
            <FormRow label="Ghi chú nội bộ">
              <input className={inputCls} placeholder="Lý do override..."
                value={overrideForm.note}
                onChange={e => setOverrideForm(p => ({ ...p, note: e.target.value }))}/>
            </FormRow>
          </FormGrid>
        </FormSection>
      </ModalForm>
    </div>
  );
}
