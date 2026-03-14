/**
 * DelegationManager.tsx  —  GEM&CLAUDE PM Pro  S6
 * ══════════════════════════════════════════════════════════════════════════
 * UI quản lý ủy quyền tạm thời.
 *
 * Sections:
 *   1. Active delegations (received + given)
 *   2. Create new delegation form
 *   3. History (expired + revoked)
 * ══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight, Plus, X, Clock, CheckCircle2, AlertTriangle,
  Shield, Users, RotateCcw, ChevronDown, Calendar, Zap,
  UserCheck, UserX, Info,
} from 'lucide-react';
import { ROLES, type RoleId, AUTHORITY_LEVEL, type DocType } from './permissions';
import { type UserContext } from './permissions';
import {
  type Delegation,
  loadDelegations, createDelegation, revokeDelegation,
  getDelegationSummary, isDelegationActive,
} from './delegation';
import { loadMembers, type ProjectMember } from './projectMember';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function daysLeft(endAt: string): number {
  return Math.ceil((new Date(endAt).getTime() - Date.now()) / 86400000);
}

function hoursLeft(endAt: string): number {
  return Math.round((new Date(endAt).getTime() - Date.now()) / 3600000);
}

const STATUS_CFG = {
  active:  { label: 'Đang hoạt động', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  expired: { label: 'Đã hết hạn',     color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-200'     },
  revoked: { label: 'Đã thu hồi',     color: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200'       },
};

const DURATION_OPTS = [
  { label: '1 ngày',   value: 1  },
  { label: '3 ngày',   value: 3  },
  { label: '7 ngày',   value: 7  },
  { label: '14 ngày',  value: 14 },
  { label: '30 ngày',  value: 30 },
];

// Chỉ 1 số docTypes phổ biến để chọn nhanh
const QUICK_DOC_TYPES: { id: DocType; label: string }[] = [
  { id: 'WAREHOUSE_EXIT',      label: 'Phiếu xuất kho' },
  { id: 'WAREHOUSE_ENTRY',     label: 'Phiếu nhập kho' },
  { id: 'MATERIAL_REQUEST',    label: 'Đề xuất vật tư' },
  { id: 'PAYMENT_REQUEST',     label: 'Đề nghị thanh toán' },
  { id: 'VARIATION_ORDER',     label: 'Lệnh thay đổi (VO)' },
  { id: 'ACCEPTANCE_INTERNAL', label: 'Nghiệm thu nội bộ' },
  { id: 'FINANCIAL_VOUCHER',   label: 'Phiếu chi' },
  { id: 'LEAVE_REQUEST',       label: 'Đơn nghỉ phép' },
  { id: 'HSE_INCIDENT',        label: 'Báo cáo sự cố HSE' },
  { id: 'NCR',                 label: 'Không phù hợp (NCR)' },
];

// ─────────────────────────────────────────────────────────────────────────────
// DELEGATION CARD
// ─────────────────────────────────────────────────────────────────────────────

function DelegationCard({
  d, ctx, onRevoke, perspective,
}: {
  d: Delegation;
  ctx: UserContext;
  onRevoke: (id: string) => void;
  perspective: 'received' | 'given' | 'all';
}) {
  const st   = STATUS_CFG[d.status];
  const left = isDelegationActive(d) ? daysLeft(d.endAt) : 0;
  const hrs  = isDelegationActive(d) ? hoursLeft(d.endAt) : 0;
  const expiringSoon = isDelegationActive(d) && hrs <= 24;
  const canRevoke = d.fromUserId === ctx.userId && isDelegationActive(d);

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${st.bg}`}>
      {/* Header stripe */}
      {expiringSoon && (
        <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-500"/>
      )}

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* Arrow: from → to */}
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                  AUTHORITY_LEVEL[d.fromRoleId] >= 4 ? 'bg-violet-100 text-violet-700' :
                  AUTHORITY_LEVEL[d.fromRoleId] >= 3 ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  L{AUTHORITY_LEVEL[d.fromRoleId]}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-semibold">Từ</p>
                  <p className="text-xs font-bold text-slate-700 truncate">{d.fromUserName}</p>
                  <p className="text-[9px] text-slate-400">{ROLES[d.fromRoleId]?.label}</p>
                </div>
              </div>
              <ArrowRight size={14} className="text-slate-300 shrink-0 mx-0.5"/>
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                  AUTHORITY_LEVEL[d.toRoleId] >= 4 ? 'bg-violet-100 text-violet-700' :
                  AUTHORITY_LEVEL[d.toRoleId] >= 3 ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  L{AUTHORITY_LEVEL[d.toRoleId]}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-semibold">Đến</p>
                  <p className="text-xs font-bold text-slate-700 truncate">{d.toUserName}</p>
                  <p className="text-[9px] text-slate-400">{ROLES[d.toRoleId]?.label}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${st.color}`}>
            {d.status === 'active' ? (
              expiringSoon
                ? `⚠ Còn ${hrs}h`
                : `✓ Còn ${left}d`
            ) : st.label}
          </span>
        </div>

        {/* Reason */}
        <p className="text-xs text-slate-600 mb-2 leading-relaxed">
          <span className="font-semibold">Lý do:</span> {d.reason}
        </p>

        {/* Level grant badge */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap size={9}/> Level {d.levelGrant} tạm
          </span>
          {d.domainGrant.map(dm => (
            <span key={dm} className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full">
              {dm}
            </span>
          ))}
          {d.docTypes && d.docTypes.length > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
              {d.docTypes.length} loại CT cụ thể
            </span>
          )}
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <Calendar size={10} className="shrink-0"/>
          <span>{fmtDate(d.startAt)} → {fmtDate(d.endAt)}</span>
        </div>

        {/* Actions */}
        {canRevoke && (
          <div className="mt-3 pt-3 border-t border-current/10">
            <button
              onClick={() => onRevoke(d.id)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl hover:bg-rose-100 transition-colors"
            >
              <UserX size={11}/> Thu hồi ủy quyền
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE FORM
// ─────────────────────────────────────────────────────────────────────────────

interface CreateFormProps {
  projectId: string;
  ctx:       UserContext;
  members:   ProjectMember[];
  onCreated: () => void;
  onCancel:  () => void;
}

function CreateDelegationForm({ projectId, ctx, members, onCreated, onCancel }: CreateFormProps) {
  const [toUserId,     setToUserId]     = useState('');
  const [reason,       setReason]       = useState('');
  const [note,         setNote]         = useState('');
  const [duration,     setDuration]     = useState(7);
  const [limitDocs,    setLimitDocs]    = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<DocType[]>([]);
  const [error,        setError]        = useState('');

  const fromLevel = AUTHORITY_LEVEL[ctx.roleId] || 1;

  // Candidates: members khác, level thấp hơn hoặc bằng, đang có trong project
  const candidates = members.filter(m =>
    m.userId !== ctx.userId &&
    (AUTHORITY_LEVEL[m.activeRoleId] || 1) <= fromLevel
  );

  const toMember = candidates.find(m => m.userId === toUserId);

  const handleSubmit = () => {
    if (!toUserId) { setError('Chọn người nhận ủy quyền'); return; }
    if (!reason.trim()) { setError('Nhập lý do ủy quyền'); return; }

    const result = createDelegation({
      projectId,
      fromUserId:   ctx.userId,
      fromUserName: ctx.userName,
      fromRoleId:   ctx.roleId,
      toUserId,
      toUserName:   toMember?.userName || toUserId,
      toRoleId:     toMember?.activeRoleId || ctx.roleId,
      reason,
      note,
      durationDays: duration,
      docTypes:     limitDocs && selectedDocs.length > 0 ? selectedDocs : undefined,
    });

    if (result.ok) {
      onCreated();
    } else {
      setError(result.error || 'Có lỗi xảy ra');
    }
  };

  const toggleDoc = (dt: DocType) => {
    setSelectedDocs(prev =>
      prev.includes(dt) ? prev.filter(d => d !== dt) : [...prev, dt]
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <UserCheck size={16} className="text-blue-400"/>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Tạo ủy quyền mới</p>
            <p className="text-slate-400 text-[10px]">Từ {ctx.userName} — {ROLES[ctx.roleId]?.label}</p>
          </div>
        </div>
        <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
          <X size={16}/>
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* To user */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Người nhận ủy quyền *
          </label>
          <select
            value={toUserId}
            onChange={e => setToUserId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            <option value="">— Chọn người nhận —</option>
            {candidates.map(m => (
              <option key={m.userId} value={m.userId}>
                {m.userName} ({m.roles.map(r => ROLES[r]?.label || r).join(', ')})
              </option>
            ))}
          </select>
          {candidates.length === 0 && (
            <p className="text-[10px] text-amber-600 mt-1">
              Không có thành viên phù hợp để ủy quyền trong project này.
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Lý do ủy quyền *
          </label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="VD: Tôi đi công tác 7 ngày, CHPhó xử lý thay..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Thời hạn
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {DURATION_OPTS.map(o => (
              <button
                key={o.value}
                onClick={() => setDuration(o.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                  duration === o.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Hiệu lực đến: {new Date(Date.now() + duration * 86400000).toLocaleDateString('vi-VN', {
              weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
            })}
          </p>
        </div>

        {/* Limit doc types */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={limitDocs}
              onChange={e => setLimitDocs(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
            />
            <span className="text-xs font-bold text-slate-600">
              Giới hạn loại chứng từ được ủy quyền
            </span>
          </label>
          {limitDocs && (
            <div className="flex flex-wrap gap-1.5 pl-6">
              {QUICK_DOC_TYPES.map(dt => (
                <button
                  key={dt.id}
                  onClick={() => toggleDoc(dt.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    selectedDocs.includes(dt.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
              {selectedDocs.length === 0 && (
                <p className="text-[10px] text-amber-600 w-full">
                  Chọn ít nhất 1 loại chứng từ, hoặc bỏ giới hạn để ủy quyền toàn bộ.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Note */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Ghi chú thêm
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Hướng dẫn cụ thể cho người nhận..."
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
          <Info size={13} className="text-blue-500 shrink-0 mt-0.5"/>
          <p className="text-[11px] text-blue-700 leading-relaxed">
            Người nhận sẽ được cấp tạm <strong>Level {AUTHORITY_LEVEL[ctx.roleId]}</strong> và domain{' '}
            <strong>{(ROLES[ctx.roleId] as any)?.domains?.join(', ') || ctx.roleId}</strong>{' '}
            trong thời gian ủy quyền. Mọi thao tác sẽ được ghi vào audit log.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-700 font-semibold">
            <AlertTriangle size={12} className="shrink-0"/>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={!toUserId || !reason.trim()}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Tạo ủy quyền
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface DelegationManagerProps {
  projectId:   string;
  projectName: string;
  ctx:         UserContext;
  onClose?:    () => void;
}

export default function DelegationManager({
  projectId, projectName, ctx, onClose,
}: DelegationManagerProps) {
  const [summary,     setSummary]     = useState<ReturnType<typeof getDelegationSummary> | null>(null);
  const [members,     setMembers]     = useState<ProjectMember[]>([]);
  const [showCreate,  setShowCreate]  = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tab,         setTab]         = useState<'received' | 'given'>('received');

  const refresh = useCallback(() => {
    setSummary(getDelegationSummary(projectId));
    setMembers(loadMembers(projectId));
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRevoke = (id: string) => {
    if (!confirm('Thu hồi ủy quyền này?')) return;
    revokeDelegation(projectId, id, ctx.userId);
    refresh();
  };

  const handleCreated = () => {
    setShowCreate(false);
    refresh();
  };

  if (!summary) return null;

  const myReceived = summary.active.filter(d => d.toUserId === ctx.userId);
  const myGiven    = summary.active.filter(d => d.fromUserId === ctx.userId);
  const canCreate  = (AUTHORITY_LEVEL[ctx.roleId] || 1) >= 2;

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Shield size={16} className="text-blue-600"/>
              Quản lý ủy quyền
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{projectName}</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={18}/>
            </button>
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: 'Tôi nhận',  value: myReceived.length, color: myReceived.length > 0 ? 'text-blue-600' : 'text-slate-400',    bg: myReceived.length > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200' },
            { label: 'Tôi trao',  value: myGiven.length,    color: myGiven.length > 0 ? 'text-emerald-600' : 'text-slate-400',   bg: myGiven.length > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200' },
            { label: 'Sắp hết hạn', value: summary.expiringSoon.length, color: summary.expiringSoon.length > 0 ? 'text-amber-600' : 'text-slate-400', bg: summary.expiringSoon.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200' },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border px-3 py-2 ${k.bg}`}>
              <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
              <p className="text-[9px] text-slate-500">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-2 shrink-0 flex items-center gap-1">
        {(['received', 'given'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t === 'received' ? <UserCheck size={11}/> : <Users size={11}/>}
            {t === 'received' ? 'Tôi được ủy quyền' : 'Tôi đã ủy quyền'}
            {(t === 'received' ? myReceived : myGiven).length > 0 && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center ${
                tab === t ? 'bg-amber-400 text-slate-900' : 'bg-slate-200 text-slate-600'
              }`}>
                {(t === 'received' ? myReceived : myGiven).length}
              </span>
            )}
          </button>
        ))}

        {/* Create button */}
        {canCreate && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all"
          >
            <Plus size={12}/> Tạo ủy quyền
          </button>
        )}
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* Create form */}
        {showCreate && (
          <CreateDelegationForm
            projectId={projectId}
            ctx={ctx}
            members={members}
            onCreated={handleCreated}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* Active delegations */}
        {(tab === 'received' ? myReceived : myGiven).length === 0 ? (
          !showCreate && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <Shield size={24} className="text-slate-300"/>
              </div>
              <p className="text-sm font-bold text-slate-500 mb-1">
                {tab === 'received' ? 'Chưa có ủy quyền nào cho bạn' : 'Bạn chưa ủy quyền cho ai'}
              </p>
              {tab === 'given' && canCreate && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  + Tạo ủy quyền đầu tiên
                </button>
              )}
            </div>
          )
        ) : (
          (tab === 'received' ? myReceived : myGiven).map(d => (
            <DelegationCard
              key={d.id}
              d={d}
              ctx={ctx}
              onRevoke={handleRevoke}
              perspective={tab}
            />
          ))
        )}

        {/* History toggle */}
        {(summary.expired.length > 0 || summary.revoked.length > 0) && (
          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <RotateCcw size={11}/>
              Lịch sử ({summary.expired.length + summary.revoked.length})
              {showHistory ? <ChevronDown size={11} className="rotate-180"/> : <ChevronDown size={11}/>}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-2">
                {[...summary.expired, ...summary.revoked]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(d => (
                    <DelegationCard
                      key={d.id}
                      d={d}
                      ctx={ctx}
                      onRevoke={handleRevoke}
                      perspective="all"
                    />
                  ))
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
