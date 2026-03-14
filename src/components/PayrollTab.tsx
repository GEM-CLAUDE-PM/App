// PayrollTab.tsx — GEM&CLAUDE PM Pro · S11
// Tính lương + BHXH/BHYT/BHTN + Thuế TNCN lũy tiến + In phiếu lương
// Tỷ lệ theo Luật BHXH 2024, Nghị định 58/2020

import React, { useState } from 'react';
import { Printer, AlertTriangle, FileSpreadsheet, X, Calculator } from 'lucide-react';

// ── Types (inline để độc lập) ────────────────────────────────────────────────
interface Employee {
  id: string; full_name: string; position: string; department: string;
  bhxh: string; bhyt: string; avatar_initial: string;
  salary_base: number; allowance: number;
  status: 'active' | 'probation' | 'maternity' | 'resigned' | 'terminated';
}

interface PayrollTabProps {
  employees: Employee[];
  projectName: string;
}

// ── Tỷ lệ BHXH 2024 ─────────────────────────────────────────────────────────
const BHXH_NLD   = 0.08;    // Người lao động
const BHYT_NLD   = 0.015;
const BHTN_NLD   = 0.01;
const BHXH_NSDLD = 0.175;   // Người sử dụng lao động
const BHYT_NSDLD = 0.03;
const BHTN_NSDLD = 0.01;
const GIAM_TRU_BT = 11000;  // Giảm trừ bản thân (K đồng/tháng)

// ── Thuế TNCN lũy tiến ───────────────────────────────────────────────────────
function calcTNCN(taxable: number): number {
  if (taxable <= 0) return 0;
  const brackets = [
    { ceiling: 5000,     rate: 0.05 },
    { ceiling: 10000,    rate: 0.10 },
    { ceiling: 18000,    rate: 0.15 },
    { ceiling: 32000,    rate: 0.20 },
    { ceiling: 52000,    rate: 0.25 },
    { ceiling: 80000,    rate: 0.30 },
    { ceiling: Infinity, rate: 0.35 },
  ];
  let tax = 0; let prev = 0;
  for (const b of brackets) {
    const slice = Math.min(taxable, b.ceiling) - prev;
    if (slice <= 0) break;
    tax += slice * b.rate;
    prev = b.ceiling;
  }
  return tax;
}

// ── Tính payslip ─────────────────────────────────────────────────────────────
function calcPayslip(emp: Employee) {
  const gross         = emp.salary_base + emp.allowance;
  const bhxh          = emp.salary_base * BHXH_NLD;
  const bhyt          = emp.salary_base * BHYT_NLD;
  const bhtn          = emp.salary_base * BHTN_NLD;
  const totalDeduct   = bhxh + bhyt + bhtn;
  const taxable       = Math.max(0, gross - totalDeduct - GIAM_TRU_BT);
  const tncn          = calcTNCN(taxable);
  const netSalary     = gross - totalDeduct - tncn;
  const bhxh_nsd      = emp.salary_base * BHXH_NSDLD;
  const bhyt_nsd      = emp.salary_base * BHYT_NSDLD;
  const bhtn_nsd      = emp.salary_base * BHTN_NSDLD;
  const totalCostNSD  = gross + bhxh_nsd + bhyt_nsd + bhtn_nsd;
  return { gross, bhxh, bhyt, bhtn, totalDeduct, taxable, tncn, netSalary,
           bhxh_nsd, bhyt_nsd, bhtn_nsd, totalCostNSD };
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

// ── Print phiếu lương ────────────────────────────────────────────────────────
function printPayslip(emp: Employee, projectName: string, payMonth: string) {
  const p = calcPayslip(emp);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html lang="vi"><head>
    <meta charset="UTF-8"><title>Phiếu lương ${emp.full_name}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:"Times New Roman",serif;font-size:13px;padding:20mm 25mm;color:#1a1a1a}
      h2{text-align:center;font-size:15px;font-weight:bold;text-transform:uppercase;margin-bottom:4px}
      .sub{text-align:center;font-size:11px;color:#555;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-bottom:14px}
      th,td{border:1px solid #bbb;padding:5px 10px;font-size:12px}
      th{background:#f0f0f0;font-weight:bold;text-align:left}
      .right{text-align:right}
      .income{background:#f0fff4}
      .deduct{background:#fff8f0}
      .net{background:#e8f4ff;font-weight:bold;font-size:13px}
      .total{font-weight:bold}
      .nsd{background:#f5f0ff}
      .signs{margin-top:30px;display:flex;justify-content:space-between;text-align:center}
      .signs div{width:45%}
      .signs p{margin:0 0 60px}
      @page{size:A4;margin:20mm}
    </style></head><body>
    <h2>Phiếu lương tháng ${payMonth}</h2>
    <div class="sub">${projectName} — GEM&CLAUDE PM Pro</div>
    <table>
      <tr><th colspan="2">THÔNG TIN NHÂN VIÊN</th></tr>
      <tr><td>Họ và tên</td><td><strong>${emp.full_name}</strong></td></tr>
      <tr><td>Chức vụ / Phòng ban</td><td>${emp.position} — ${emp.department}</td></tr>
      <tr><td>Số BHXH</td><td>${emp.bhxh || '(Chưa có)'}</td></tr>
      <tr><td>Số thẻ BHYT</td><td>${emp.bhyt || '(Chưa có)'}</td></tr>
    </table>
    <table>
      <tr><th>Khoản mục</th><th class="right">Số tiền (K đồng)</th></tr>
      <tr class="income"><td>1. Lương cơ bản</td><td class="right">${fmt(emp.salary_base)}</td></tr>
      <tr class="income"><td>2. Phụ cấp</td><td class="right">${fmt(emp.allowance)}</td></tr>
      <tr class="income total"><td>TỔNG THU NHẬP GỘP</td><td class="right">${fmt(p.gross)}</td></tr>
      <tr class="deduct"><td>3. BHXH NLĐ đóng (8% lương CB)</td><td class="right">- ${fmt(p.bhxh)}</td></tr>
      <tr class="deduct"><td>4. BHYT NLĐ đóng (1.5% lương CB)</td><td class="right">- ${fmt(p.bhyt)}</td></tr>
      <tr class="deduct"><td>5. BHTN NLĐ đóng (1% lương CB)</td><td class="right">- ${fmt(p.bhtn)}</td></tr>
      <tr class="deduct"><td>6. Thu nhập tính thuế TNCN</td><td class="right">${fmt(p.taxable)}</td></tr>
      <tr class="deduct"><td>7. Thuế TNCN (lũy tiến)</td><td class="right">- ${fmt(p.tncn)}</td></tr>
      <tr class="net"><td>THỰC LĨNH</td><td class="right">${fmt(p.netSalary)}</td></tr>
    </table>
    <table>
      <tr><th colspan="2">CHI PHÍ NSDLĐ ĐÓNG THÊM (không trừ vào lương NLĐ)</th></tr>
      <tr class="nsd"><td>BHXH NSDLĐ đóng (17.5%)</td><td class="right">${fmt(p.bhxh_nsd)}</td></tr>
      <tr class="nsd"><td>BHYT NSDLĐ đóng (3%)</td><td class="right">${fmt(p.bhyt_nsd)}</td></tr>
      <tr class="nsd"><td>BHTN NSDLĐ đóng (1%)</td><td class="right">${fmt(p.bhtn_nsd)}</td></tr>
      <tr class="nsd total"><td>TỔNG CHI PHÍ NHÂN CÔNG (NSDLĐ)</td><td class="right">${fmt(p.totalCostNSD)}</td></tr>
    </table>
    <div class="signs">
      <div><p>Người lao động<br/>(Ký, ghi rõ họ tên)</p><strong>${emp.full_name}</strong></div>
      <div><p>Kế toán / Phụ trách HR<br/>(Ký, đóng dấu)</p></div>
    </div>
  </body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PayrollTab({ employees, projectName }: PayrollTabProps) {
  const activeList = employees.filter(e => e.status === 'active' || e.status === 'probation');
  const [selEmp, setSelEmp] = useState<Employee | null>(null);
  const payMonth = new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }).replace(' ', '/');

  const totals = activeList.reduce((acc, emp) => {
    const p = calcPayslip(emp);
    return {
      gross:      acc.gross      + p.gross,
      net:        acc.net        + p.netSalary,
      bhxh:       acc.bhxh       + p.bhxh,
      tncn:       acc.tncn       + p.tncn,
      totalCost:  acc.totalCost  + p.totalCostNSD,
    };
  }, { gross: 0, net: 0, bhxh: 0, tncn: 0, totalCost: 0 });

  const missingBHXH = employees.filter(e => e.status === 'active' && !e.bhxh);

  return (
    <div className="space-y-4">

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Nhân sự tính lương', value: `${activeList.length} người`,    cls: 'text-violet-700' },
          { label: 'Tổng thực lĩnh',     value: `${fmt(totals.net)}K`,           cls: 'text-emerald-700' },
          { label: 'Tổng chi phí NC',    value: `${fmt(totals.totalCost)}K`,     cls: 'text-blue-700' },
          { label: 'Tổng BHXH NLĐ',     value: `${fmt(totals.bhxh)}K`,          cls: 'text-amber-700' },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className={`text-xl font-bold ${k.cls}`}>{k.value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tỷ lệ reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-xs text-blue-800 flex flex-wrap gap-x-5 gap-y-1">
        <span className="font-bold">Tỷ lệ 2024:</span>
        <span>BHXH: NLĐ <b>8%</b> · NSDLĐ <b>17.5%</b></span>
        <span>BHYT: NLĐ <b>1.5%</b> · NSDLĐ <b>3%</b></span>
        <span>BHTN: NLĐ <b>1%</b> · NSDLĐ <b>1%</b></span>
        <span>Giảm trừ bản thân: <b>11,000K/tháng</b></span>
        <span>Thuế TNCN: <b>lũy tiến 5%–35%</b></span>
      </div>

      {/* Cảnh báo thiếu BHXH */}
      {missingBHXH.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">{missingBHXH.length} nhân viên chưa có số BHXH</p>
            <p className="text-xs text-red-600 mt-0.5">{missingBHXH.map(e => e.full_name).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Bảng lương */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <FileSpreadsheet size={14} className="text-violet-600" />
            Bảng lương tháng {payMonth}
          </h3>
          <span className="text-[11px] text-slate-400">Nhấn vào dòng để xem phiếu lương chi tiết</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Nhân viên','Lương CB','Phụ cấp','Gộp','BHXH 8%','BHYT 1.5%','BHTN 1%','Thuế TNCN','Thực lĩnh','CP NSDLĐ',''].map((h,i) => (
                  <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeList.map(emp => {
                const p = calcPayslip(emp);
                return (
                  <tr key={emp.id}
                    onClick={() => setSelEmp(emp)}
                    className="border-b border-slate-100 hover:bg-violet-50/40 cursor-pointer transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {emp.avatar_initial}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 whitespace-nowrap">{emp.full_name}</p>
                          <p className="text-[10px] text-slate-400">{emp.position}</p>
                        </div>
                        {!emp.bhxh && <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">Thiếu BHXH</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(emp.salary_base)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">{fmt(emp.allowance)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{fmt(p.gross)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-orange-600">-{fmt(p.bhxh)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-orange-600">-{fmt(p.bhyt)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-orange-600">-{fmt(p.bhtn)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-600">-{fmt(p.tncn)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">{fmt(p.netSalary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-700">{fmt(p.totalCostNSD)}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={e => { e.stopPropagation(); printPayslip(emp, projectName, payMonth); }}
                        className="flex items-center gap-1 px-2 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-bold hover:bg-violet-700 whitespace-nowrap">
                        <Printer size={10} /> In
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-700" colSpan={3}>
                  TỔNG ({activeList.length} người)
                </td>
                <td className="px-3 py-2.5 text-right font-bold font-mono">{fmt(totals.gross)}</td>
                <td className="px-3 py-2.5 text-right font-bold font-mono text-orange-600">-{fmt(totals.bhxh)}</td>
                <td colSpan={2} />
                <td className="px-3 py-2.5 text-right font-bold font-mono text-red-600">-{fmt(totals.tncn)}</td>
                <td className="px-3 py-2.5 text-right font-bold font-mono text-emerald-700">{fmt(totals.net)}</td>
                <td className="px-3 py-2.5 text-right font-bold font-mono text-blue-700">{fmt(totals.totalCost)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal phiếu lương chi tiết */}
      {selEmp && (() => {
        const p = calcPayslip(selEmp);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelEmp(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>

              {/* Header modal */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
                <div>
                  <p className="font-bold text-slate-800">{selEmp.full_name}</p>
                  <p className="text-xs text-slate-400">{selEmp.position} · Tháng {payMonth}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => printPayslip(selEmp, projectName, payMonth)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700">
                    <Printer size={12} /> In phiếu lương
                  </button>
                  <button onClick={() => setSelEmp(null)}
                    className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center">
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {/* Thu nhập */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Thu nhập</p>
                  {[
                    ['Lương cơ bản', `${fmt(selEmp.salary_base)}K`],
                    ['Phụ cấp',      `${fmt(selEmp.allowance)}K`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-slate-600">{k}</span>
                      <span className="font-semibold">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-emerald-300 pt-2 mt-1">
                    <span>Thu nhập gộp</span>
                    <span className="text-emerald-700">{fmt(p.gross)}K</span>
                  </div>
                </div>

                {/* Khấu trừ */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
                  <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">Khấu trừ (NLĐ)</p>
                  {[
                    ['BHXH (8% lương CB)',   `-${fmt(p.bhxh)}K`],
                    ['BHYT (1.5% lương CB)', `-${fmt(p.bhyt)}K`],
                    ['BHTN (1% lương CB)',   `-${fmt(p.bhtn)}K`],
                    ['Thu nhập tính thuế',   `${fmt(p.taxable)}K`],
                    ['Thuế TNCN lũy tiến',  `-${fmt(p.tncn)}K`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-slate-600">{k}</span>
                      <span className={`font-semibold ${(v as string).startsWith('-') ? 'text-orange-700' : 'text-slate-700'}`}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Thực lĩnh */}
                <div className="bg-violet-600 rounded-xl px-4 py-3 flex items-center justify-between text-white">
                  <span className="font-bold">THỰC LĨNH</span>
                  <span className="text-2xl font-black">{fmt(p.netSalary)}K</span>
                </div>

                {/* NSDLĐ */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                  <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Chi phí NSDLĐ đóng thêm</p>
                  {[
                    ['BHXH (17.5%)', `${fmt(p.bhxh_nsd)}K`],
                    ['BHYT (3%)',    `${fmt(p.bhyt_nsd)}K`],
                    ['BHTN (1%)',    `${fmt(p.bhtn_nsd)}K`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-slate-600">{k}</span>
                      <span className="font-semibold text-blue-700">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-blue-300 pt-2 mt-1">
                    <span>Tổng chi phí nhân công</span>
                    <span className="text-blue-700">{fmt(p.totalCostNSD)}K</span>
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
