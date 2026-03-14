// PayrollTab.tsx — GEM&CLAUDE PM Pro · S11
// Bảng lương: BHXH/BHYT/BHTN + Thuế TNCN lũy tiến + OT + Tạm ứng + Giảm trừ gia cảnh
// Gộp theo tổ/đội · Lịch sử · Khóa bảng lương · Export Excel · In phiếu lương

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Printer, AlertTriangle, FileSpreadsheet, X, Calculator,
  ChevronDown, ChevronUp, Search, Lock, Unlock, CheckCircle,
  Clock, CreditCard, Users, TrendingUp, Download, Save,
  Plus, Minus, Eye, Filter,
} from 'lucide-react';
import { db } from './db';
import { useNotification } from './NotificationEngine';
import { printPayslip } from './PayrollSlip';
import { exportPayrollExcel } from './PayrollExcel';
import {
  calcPayslip, calcTotals, groupByTeam, genRefCode,
  getLast12Months, getCurrentPeriodLabel,
  fmt, CONTRACT_LABEL, STATUS_LABEL, PAYMENT_LABEL, RATES, GIAM_TRU,
  SEED_EMPLOYEES,
  type Employee, type PayrollRecord, type PayrollPeriod,
  type PaymentStatus, type PayPeriodType,
} from './PayrollTypes';

interface PayrollTabProps {
  pid:         string;
  projectName: string;
}

type ViewMode = 'current' | 'history';

// ── Helpers ────────────────────────────────────────────────────────────────────
function makePeriodId(pid: string, label: string) {
  return `payroll_${pid}_${label.replace(/\//g, '-')}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function PayrollTab({ pid, projectName }: PayrollTabProps) {
  const { ok: notifOk, err: notifErr } = useNotification();

  // ── State ──────────────────────────────────────────────────────────────────
  const [view, setView]                   = useState<ViewMode>('current');
  const [employees, setEmployees]         = useState<Employee[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<PayrollPeriod | null>(null);
  const [history, setHistory]             = useState<PayrollPeriod[]>([]);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState(getCurrentPeriodLabel());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [selEmp, setSelEmp]               = useState<Employee | null>(null);
  const [searchQ, setSearchQ]             = useState('');
  const [filterTeam, setFilterTeam]       = useState('all');
  const [exporting, setExporting]         = useState(false);
  // Input overrides per employee: { [emp_id]: { ot_weekday, ot_weekend, ot_holiday, bonus, advances, days_worked } }
  const [inputs, setInputs]               = useState<Record<string, Partial<PayrollRecord>>>({});

  const months = getLast12Months();

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [emps, att, hist] = await Promise.all([
        db.get<Employee[]>('hr_employees', pid, SEED_EMPLOYEES),
        db.get<any[]>('mp_attendance', pid, []),
        db.get<PayrollPeriod[]>('hr_payroll_history', pid, []),
      ]);
      setEmployees(emps);
      setHistory(hist);

      // Auto-fill OT từ attendance
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthAtt = att.filter((a: any) => a.date?.startsWith(thisMonth));
      const presentDays = new Set(monthAtt.filter((a: any) => a.status === 'present' || a.status === 'half').map((a: any) => a.date)).size;

      const autoInputs: Record<string, Partial<PayrollRecord>> = {};
      for (const emp of emps) {
        const empAtt = monthAtt.filter((a: any) => a.personId === emp.id);
        const daysWorked = empAtt.filter((a: any) => a.status === 'present').length
          + empAtt.filter((a: any) => a.status === 'half').length * 0.5;
        const ot_weekday = empAtt.filter((a: any) => a.otType === 'weekday').reduce((s: number, a: any) => s + (a.otHours || 0), 0);
        const ot_weekend = empAtt.filter((a: any) => a.otType === 'weekend').reduce((s: number, a: any) => s + (a.otHours || 0), 0);
        const ot_holiday = empAtt.filter((a: any) => a.otType === 'holiday').reduce((s: number, a: any) => s + (a.otHours || 0), 0);
        autoInputs[emp.id] = {
          days_worked: daysWorked || 26,
          days_in_period: presentDays || 26,
          ot_weekday, ot_weekend, ot_holiday,
          bonus: 0, advances: 0,
        };
      }
      setInputs(autoInputs);

      // Load current period nếu đã có
      const periodId = makePeriodId(pid, getCurrentPeriodLabel());
      const existing = hist.find(p => p.id === periodId);
      if (existing) setCurrentPeriod(existing);
    })();
  }, [pid]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const activeEmps = useMemo(() =>
    employees.filter(e => e.status === 'active' || e.status === 'probation'),
    [employees]
  );

  const filteredEmps = useMemo(() => activeEmps.filter(e => {
    const q = searchQ.toLowerCase();
    const matchSearch = !q || e.full_name.toLowerCase().includes(q) || e.position.toLowerCase().includes(q);
    const matchTeam = filterTeam === 'all' || (e.team || e.department) === filterTeam;
    return matchSearch && matchTeam;
  }), [activeEmps, searchQ, filterTeam]);

  const teams = useMemo(() =>
    [...new Set(activeEmps.map(e => e.team || e.department || 'Chưa phân nhóm'))],
    [activeEmps]
  );

  const teamGroups = useMemo(() => groupByTeam(filteredEmps), [filteredEmps]);

  const getInput = useCallback((empId: string) => ({
    days_worked:    inputs[empId]?.days_worked    ?? 26,
    days_in_period: inputs[empId]?.days_in_period ?? 26,
    ot_weekday:     inputs[empId]?.ot_weekday     ?? 0,
    ot_weekend:     inputs[empId]?.ot_weekend     ?? 0,
    ot_holiday:     inputs[empId]?.ot_holiday     ?? 0,
    bonus:          inputs[empId]?.bonus          ?? 0,
    advances:       inputs[empId]?.advances       ?? 0,
  }), [inputs]);

  const setInput = useCallback((empId: string, field: string, value: number) => {
    setInputs(prev => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }));
  }, []);

  // Tính tất cả payslips
  const allCalcs = useMemo(() => {
    const result: Record<string, ReturnType<typeof calcPayslip>> = {};
    for (const emp of activeEmps) {
      result[emp.id] = calcPayslip(emp, getInput(emp.id));
    }
    return result;
  }, [activeEmps, getInput]);

  const grandTotals = useMemo(() =>
    calcTotals(Object.values(allCalcs)),
    [allCalcs]
  );

  const missingBHXH = useMemo(() =>
    activeEmps.filter(e => !e.bhxh && e.contract_type !== 'thoi_vu' && e.contract_type !== 'ctv'),
    [activeEmps]
  );

  // ── Save period ────────────────────────────────────────────────────────────
  const savePeriod = useCallback(async (lock = false) => {
    const label = getCurrentPeriodLabel();
    const periodId = makePeriodId(pid, label);
    let seq = 1;

    const records: PayrollRecord[] = activeEmps.map(emp => {
      const inp = getInput(emp.id);
      const calc = allCalcs[emp.id];
      return {
        id:              `rec_${emp.id}_${label.replace(/\//g, '')}`,
        emp_id:          emp.id,
        period_label:    label,
        period_start:    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        period_end:      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
        period_type:     'monthly' as PayPeriodType,
        days_worked:     inp.days_worked,
        days_in_period:  inp.days_in_period,
        ot_weekday:      inp.ot_weekday,
        ot_weekend:      inp.ot_weekend,
        ot_holiday:      inp.ot_holiday,
        bonus:           inp.bonus,
        advances:        inp.advances,
        ...calc,
        payment_status:  'pending' as PaymentStatus,
        locked:          lock,
        ref_code:        genRefCode(pid, emp.id, label),
        created_at:      new Date().toISOString(),
        notes:           '',
      };
    });

    const period: PayrollPeriod = {
      id: periodId, project_id: pid,
      period_type: 'monthly', period_label: label,
      period_start: records[0]?.period_start || '',
      period_end:   records[0]?.period_end   || '',
      locked: lock, records,
      created_at: new Date().toISOString(),
    };

    setCurrentPeriod(period);
    const nextHist = [period, ...history.filter(p => p.id !== periodId)];
    setHistory(nextHist);
    await db.set('hr_payroll_history', pid, nextHist);
    notifOk(lock ? 'Đã khóa bảng lương!' : 'Đã lưu bảng lương!');
  }, [pid, activeEmps, getInput, allCalcs, history]);

  // ── Update payment status ──────────────────────────────────────────────────
  const updatePaymentStatus = useCallback(async (empId: string, status: PaymentStatus) => {
    if (!currentPeriod) return;
    const updated = {
      ...currentPeriod,
      records: currentPeriod.records.map(r =>
        r.emp_id === empId ? { ...r, payment_status: status } : r
      ),
    };
    setCurrentPeriod(updated);
    const nextHist = history.map(p => p.id === updated.id ? updated : p);
    setHistory(nextHist);
    await db.set('hr_payroll_history', pid, nextHist);
  }, [currentPeriod, history, pid]);

  // ── Export Excel ───────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const records = activeEmps.map(emp => {
        const inp = getInput(emp.id);
        const calc = allCalcs[emp.id];
        return {
          id: `rec_${emp.id}`, emp_id: emp.id,
          period_label: getCurrentPeriodLabel(),
          period_start: '', period_end: '',
          period_type: 'monthly' as PayPeriodType,
          days_worked: inp.days_worked, days_in_period: inp.days_in_period,
          ot_weekday: inp.ot_weekday, ot_weekend: inp.ot_weekend, ot_holiday: inp.ot_holiday,
          bonus: inp.bonus, advances: inp.advances,
          ...calc,
          payment_status: 'pending' as PaymentStatus,
          locked: false,
          ref_code: genRefCode(pid, emp.id, getCurrentPeriodLabel()),
          created_at: new Date().toISOString(),
          notes: '',
        };
      });
      await exportPayrollExcel(activeEmps, records, projectName, getCurrentPeriodLabel());
      notifOk('Xuất Excel thành công!');
    } catch { notifErr('Lỗi xuất Excel'); }
    setExporting(false);
  }, [activeEmps, getInput, allCalcs, pid, projectName]);

  const isLocked = currentPeriod?.locked ?? false;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Nhân sự',       value: `${activeEmps.length} người`,         cls: 'text-violet-700' },
          { label: 'Thu nhập gộp',  value: `${fmt(grandTotals.gross)}K`,          cls: 'text-slate-700'  },
          { label: 'Thực lĩnh',     value: `${fmt(grandTotals.net_salary)}K`,     cls: 'text-emerald-700'},
          { label: 'Tổng CP NC',    value: `${fmt(grandTotals.total_cost_nsd)}K`, cls: 'text-blue-700'   },
          { label: 'Tổng OT',       value: `${fmt(grandTotals.ot_amount)}K`,      cls: 'text-amber-700'  },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className={`text-xl font-bold ${k.cls}`}>{k.value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tỷ lệ reference ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2.5 text-xs text-blue-800 flex flex-wrap gap-x-4 gap-y-1">
        <span className="font-bold">Tỷ lệ 2024:</span>
        <span>BHXH NLĐ <b>8%</b> · NSD <b>17.5%</b></span>
        <span>BHYT NLĐ <b>1.5%</b> · NSD <b>3%</b></span>
        <span>BHTN NLĐ <b>1%</b> · NSD <b>1%</b></span>
        <span>Giảm trừ BT <b>11,000K</b></span>
        <span>NPT <b>4,400K/người</b></span>
        <span>Thuế TNCN <b>lũy tiến 5%–35%</b></span>
        <span>Ăn ca miễn thuế ≤ <b>730K</b></span>
      </div>

      {/* ── Cảnh báo BHXH ── */}
      {missingBHXH.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-bold text-red-700">{missingBHXH.length} nhân viên chưa có số BHXH</p>
            <p className="text-xs text-red-600 mt-0.5">{missingBHXH.map(e => e.full_name).join(', ')}</p>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([['current', '📊 Kỳ hiện tại'], ['history', '🗂 Lịch sử']] as [ViewMode, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${view === v ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}>
              {l}
            </button>
          ))}
        </div>

        {view === 'current' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Tìm nhân viên..."
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-36 focus:outline-none focus:ring-2 focus:ring-violet-200"/>
            </div>
            {/* Filter tổ */}
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
              <option value="all">Tất cả tổ/đội</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <div className="ml-auto flex gap-2">
              {/* Trạng thái lock */}
              {isLocked && (
                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg font-semibold">
                  <Lock size={11}/> Đã khóa
                </span>
              )}
              {/* Export Excel */}
              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-60">
                {exporting ? <span className="animate-spin">⏳</span> : <Download size={12}/>}
                Excel
              </button>
              {/* Lưu */}
              {!isLocked && (
                <button onClick={() => savePeriod(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700">
                  <Save size={12}/> Lưu
                </button>
              )}
              {/* Khóa */}
              {!isLocked && (
                <button onClick={() => savePeriod(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800">
                  <Lock size={12}/> Khóa BL
                </button>
              )}
            </div>
          </>
        )}

        {view === 'history' && (
          <select value={selectedPeriodLabel} onChange={e => setSelectedPeriodLabel(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: CURRENT PERIOD                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'current' && (
        <div className="space-y-3">
          {Object.entries(teamGroups).map(([team, emps]) => {
            const isExpanded = expandedTeams.has(team) || expandedTeams.size === 0;
            const teamCalcs = emps.map(e => allCalcs[e.id]).filter(Boolean);
            const teamTotals = calcTotals(teamCalcs);

            return (
              <div key={team} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Team header */}
                <button
                  onClick={() => setExpandedTeams(prev => {
                    const next = new Set(prev);
                    if (next.has(team)) next.delete(team); else next.add(team);
                    return next;
                  })}
                  className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 border-b border-violet-100 hover:bg-violet-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-violet-600"/>
                    <span className="font-bold text-violet-800 text-sm">{team}</span>
                    <span className="text-xs text-violet-500">({emps.length} người)</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-violet-600">
                    <span>Gộp: <b>{fmt(teamTotals.gross)}K</b></span>
                    <span>Thực lĩnh: <b className="text-emerald-700">{fmt(teamTotals.net_salary)}K</b></span>
                    {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </div>
                </button>

                {/* Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {['Nhân viên', 'Loại HĐ', 'Ngày công', 'Lương CB', 'PC', 'OT', 'Thưởng', 'Gộp',
                            'BHXH', 'TNCN', 'Tạm ứng', 'Thực lĩnh', 'CP NSD', 'TT', ''].map((h, i) => (
                            <th key={i} className="px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {emps.map(emp => {
                          const inp = getInput(emp.id);
                          const p   = allCalcs[emp.id];
                          const rec = currentPeriod?.records.find(r => r.emp_id === emp.id);

                          return (
                            <tr key={emp.id}
                              className="border-b border-slate-100 hover:bg-violet-50/30 transition-colors">
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {emp.avatar_initial}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-800 whitespace-nowrap">{emp.full_name}</p>
                                    <p className="text-[10px] text-slate-400">{emp.position}</p>
                                    {!emp.bhxh && <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1 py-0.5 rounded">Thiếu BHXH</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {CONTRACT_LABEL[emp.contract_type]}
                                </span>
                              </td>
                              {/* Ngày công — editable */}
                              <td className="px-2 py-2">
                                <input type="number" min={0} max={31}
                                  value={inp.days_worked}
                                  onChange={e => setInput(emp.id, 'days_worked', +e.target.value)}
                                  disabled={isLocked}
                                  className="w-12 text-center border border-slate-200 rounded px-1 py-0.5 text-xs disabled:bg-slate-50"/>
                                <span className="text-slate-400">/{inp.days_in_period}</span>
                              </td>
                              <td className="px-2 py-2 text-right font-mono">{fmt(p.salary_base_snap)}</td>
                              <td className="px-2 py-2 text-right font-mono text-slate-500">{fmt(p.allowances_taxable + p.allowances_exempt)}</td>
                              {/* OT — editable */}
                              <td className="px-2 py-2">
                                <input type="number" min={0}
                                  value={inp.ot_weekday + inp.ot_weekend + inp.ot_holiday}
                                  onChange={e => setInput(emp.id, 'ot_weekday', +e.target.value)}
                                  disabled={isLocked}
                                  className="w-12 text-center border border-slate-200 rounded px-1 py-0.5 text-xs disabled:bg-slate-50"/>
                                <span className="text-[10px] text-slate-400">h</span>
                              </td>
                              {/* Thưởng — editable */}
                              <td className="px-2 py-2">
                                <input type="number" min={0}
                                  value={inp.bonus}
                                  onChange={e => setInput(emp.id, 'bonus', +e.target.value)}
                                  disabled={isLocked}
                                  className="w-16 text-right border border-slate-200 rounded px-1 py-0.5 text-xs disabled:bg-slate-50"/>
                              </td>
                              <td className="px-2 py-2 text-right font-mono font-semibold">{fmt(p.gross)}</td>
                              <td className="px-2 py-2 text-right font-mono text-orange-600">-{fmt(p.bhxh)}</td>
                              <td className="px-2 py-2 text-right font-mono text-red-600">-{fmt(p.tncn)}</td>
                              {/* Tạm ứng — editable */}
                              <td className="px-2 py-2">
                                <input type="number" min={0}
                                  value={inp.advances}
                                  onChange={e => setInput(emp.id, 'advances', +e.target.value)}
                                  disabled={isLocked}
                                  className="w-16 text-right border border-slate-200 rounded px-1 py-0.5 text-xs disabled:bg-slate-50"/>
                              </td>
                              <td className="px-2 py-2 text-right font-mono font-bold text-emerald-700">{fmt(p.net_salary)}</td>
                              <td className="px-2 py-2 text-right font-mono text-blue-700">{fmt(p.total_cost_nsd)}</td>
                              {/* Trạng thái TT */}
                              <td className="px-2 py-2">
                                {rec ? (
                                  <select
                                    value={rec.payment_status}
                                    onChange={e => updatePaymentStatus(emp.id, e.target.value as PaymentStatus)}
                                    className={`text-[10px] font-bold border-0 rounded px-1.5 py-0.5 ${PAYMENT_LABEL[rec.payment_status].cls}`}>
                                    <option value="pending">Chưa TT</option>
                                    <option value="paid">Đã TT</option>
                                    <option value="transferred">Đã CK</option>
                                  </select>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Chưa lưu</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <button onClick={() => setSelEmp(emp)}
                                  className="p-1.5 hover:bg-violet-100 rounded-lg text-violet-600 transition-colors">
                                  <Printer size={12}/>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Team footer */}
                      <tfoot className="bg-violet-50 border-t-2 border-violet-200">
                        <tr>
                          <td colSpan={7} className="px-2 py-2 font-bold text-violet-800 text-xs">
                            TỔNG {team}
                          </td>
                          <td className="px-2 py-2 text-right font-bold font-mono text-xs">{fmt(teamTotals.gross)}</td>
                          <td className="px-2 py-2 text-right font-bold font-mono text-orange-600 text-xs">-{fmt(teamTotals.bhxh)}</td>
                          <td className="px-2 py-2 text-right font-bold font-mono text-red-600 text-xs">-{fmt(teamTotals.tncn)}</td>
                          <td/>
                          <td className="px-2 py-2 text-right font-bold font-mono text-emerald-700 text-xs">{fmt(teamTotals.net_salary)}</td>
                          <td className="px-2 py-2 text-right font-bold font-mono text-blue-700 text-xs">{fmt(teamTotals.total_cost_nsd)}</td>
                          <td colSpan={2}/>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand total */}
          <div className="bg-violet-700 rounded-2xl px-5 py-3 flex flex-wrap gap-4 text-white text-sm">
            <span className="font-bold">TỔNG TOÀN DỰ ÁN ({activeEmps.length} người)</span>
            <span>Gộp: <b>{fmt(grandTotals.gross)}K</b></span>
            <span>BHXH: <b>-{fmt(grandTotals.bhxh)}K</b></span>
            <span>TNCN: <b>-{fmt(grandTotals.tncn)}K</b></span>
            <span className="text-yellow-300">Thực lĩnh: <b>{fmt(grandTotals.net_salary)}K</b></span>
            <span className="ml-auto">CP NC: <b>{fmt(grandTotals.total_cost_nsd)}K</b></span>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: HISTORY                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <FileSpreadsheet size={40} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-slate-400 text-sm">Chưa có lịch sử bảng lương. Lưu bảng lương kỳ hiện tại để bắt đầu.</p>
            </div>
          ) : (
            history
              .filter(p => selectedPeriodLabel === 'all' || p.period_label === selectedPeriodLabel)
              .map(period => (
                <div key={period.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800">Kỳ {period.period_label}</span>
                      {period.locked
                        ? <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full"><Lock size={9}/> Đã khóa</span>
                        : <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full"><Unlock size={9}/> Mở</span>
                      }
                      <span className="text-xs text-slate-400">{period.records.length} người</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>Thực lĩnh: <b className="text-emerald-700">{fmt(period.records.reduce((s, r) => s + r.net_salary, 0))}K</b></span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          {['Nhân viên', 'Tổ/Đội', 'Ngày công', 'Gộp', 'BHXH', 'TNCN', 'Thực lĩnh', 'Trạng thái', 'Mã phiếu', ''].map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {period.records.map(rec => {
                          const emp = employees.find(e => e.id === rec.emp_id);
                          if (!emp) return null;
                          return (
                            <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2 font-semibold text-slate-800">{emp.full_name}</td>
                              <td className="px-3 py-2 text-slate-500">{emp.team || emp.department}</td>
                              <td className="px-3 py-2">{rec.days_worked}/{rec.days_in_period}</td>
                              <td className="px-3 py-2 text-right font-mono">{fmt(rec.gross)}</td>
                              <td className="px-3 py-2 text-right font-mono text-orange-600">-{fmt(rec.bhxh)}</td>
                              <td className="px-3 py-2 text-right font-mono text-red-600">-{fmt(rec.tncn)}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{fmt(rec.net_salary)}</td>
                              <td className="px-3 py-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PAYMENT_LABEL[rec.payment_status].cls}`}>
                                  {PAYMENT_LABEL[rec.payment_status].label}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[10px] text-slate-400 font-mono">{rec.ref_code}</td>
                              <td className="px-3 py-2">
                                <button onClick={() => printPayslip(emp, rec, projectName)}
                                  className="p-1.5 hover:bg-violet-100 rounded-lg text-violet-600">
                                  <Printer size={12}/>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ── Modal phiếu lương chi tiết ── */}
      {selEmp && (() => {
        const inp = getInput(selEmp.id);
        const p   = allCalcs[selEmp.id];
        const rec: PayrollRecord = {
          id: `preview_${selEmp.id}`, emp_id: selEmp.id,
          period_label: getCurrentPeriodLabel(),
          period_start: '', period_end: '',
          period_type: 'monthly',
          days_worked: inp.days_worked, days_in_period: inp.days_in_period,
          ot_weekday: inp.ot_weekday, ot_weekend: inp.ot_weekend, ot_holiday: inp.ot_holiday,
          bonus: inp.bonus, advances: inp.advances,
          ...p,
          payment_status: 'pending',
          locked: false,
          ref_code: genRefCode(pid, selEmp.id, getCurrentPeriodLabel()),
          created_at: new Date().toISOString(),
          notes: '',
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelEmp(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
                <div>
                  <p className="font-bold text-slate-800">{selEmp.full_name}</p>
                  <p className="text-xs text-slate-400">{selEmp.position} · {rec.period_label}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{rec.ref_code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => printPayslip(selEmp, rec, projectName)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700">
                    <Printer size={12}/> In phiếu
                  </button>
                  <button onClick={() => setSelEmp(null)}
                    className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center">
                    <X size={15}/>
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {/* Thông tin */}
                <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['Loại HĐ', CONTRACT_LABEL[selEmp.contract_type]],
                    ['Ngày công', `${inp.days_worked}/${inp.days_in_period}`],
                    ['Người phụ thuộc', `${selEmp.dependants} người`],
                    ['Số BHXH', selEmp.bhxh || '⚠️ Chưa có'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span className="text-slate-400">{k}: </span>
                      <span className="font-semibold">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Thu nhập */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Thu nhập</p>
                  {[
                    ['Lương cơ bản', fmt(p.salary_base_snap)],
                    ['PC chịu thuế', fmt(p.allowances_taxable)],
                    ['PC miễn thuế', fmt(p.allowances_exempt)],
                    ['Tăng ca (OT)', fmt(p.ot_amount)],
                    ...(inp.bonus > 0 ? [['Thưởng', fmt(inp.bonus)]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-slate-600">{k}</span>
                      <span className="font-semibold">{v}K</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-emerald-300 pt-2 mt-1">
                    <span>Thu nhập gộp</span>
                    <span className="text-emerald-700">{fmt(p.gross)}K</span>
                  </div>
                </div>

                {/* Khấu trừ */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-1.5">
                  <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">Khấu trừ</p>
                  {[
                    ['BHXH NLĐ (8%)', `-${fmt(p.bhxh)}`],
                    ['BHYT NLĐ (1.5%)', `-${fmt(p.bhyt)}`],
                    ['BHTN NLĐ (1%)', `-${fmt(p.bhtn)}`],
                    [`Giảm trừ BT`, `${fmt(GIAM_TRU.BAN_THAN)}`],
                    ...(selEmp.dependants > 0 ? [[`Giảm trừ ${selEmp.dependants} NPT`, `${fmt(selEmp.dependants * GIAM_TRU.NGUOI_PHU_THUOC)}`]] : []),
                    ['TN tính thuế', fmt(p.taxable)],
                    ['Thuế TNCN lũy tiến', `-${fmt(p.tncn)}`],
                    ...(inp.advances > 0 ? [['Tạm ứng', `-${fmt(inp.advances)}`]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-slate-600">{k}</span>
                      <span className={`font-semibold ${String(v).startsWith('-') ? 'text-orange-700' : 'text-slate-700'}`}>{v}K</span>
                    </div>
                  ))}
                </div>

                {/* Thực lĩnh */}
                <div className="bg-violet-600 rounded-xl px-4 py-3 flex items-center justify-between text-white">
                  <span className="font-bold">THỰC LĨNH</span>
                  <span className="text-2xl font-black">{fmt(p.net_salary)}K</span>
                </div>

                {/* NSDLĐ */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1.5">
                  <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Chi phí NSDLĐ đóng thêm</p>
                  {[
                    ['BHXH (17.5%)', fmt(Math.round(p.salary_base_snap * 0.175))],
                    ['BHYT (3%)',    fmt(Math.round(p.salary_base_snap * 0.03))],
                    ['BHTN (1%)',    fmt(Math.round(p.salary_base_snap * 0.01))],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-slate-600">{k}</span>
                      <span className="font-semibold text-blue-700">{v}K</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-blue-300 pt-2 mt-1">
                    <span>Tổng CP nhân công</span>
                    <span className="text-blue-700">{fmt(p.total_cost_nsd)}K</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
