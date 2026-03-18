import { useNotification } from './NotificationEngine';
import React, { useState, useCallback, useEffect } from 'react';
import { db, useRealtimeSync } from './db';
import ModalForm, { FormRow, FormGrid, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import { getAllDocs, seedApprovalDocs, createDocument, submitDocument as engineSubmitDoc, getApprovalQueue, type ApprovalDoc } from './approvalEngine';
import type { SeedVoucherInput } from './approvalEngine';
import { createLegacyContext, WORKFLOWS, type UserContext } from './permissions';
import { getCurrentCtx } from './projectMember';
import ApprovalQueue from './ApprovalQueue';
import { ClipboardList } from 'lucide-react';
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import {
  DollarSign, TrendingUp, TrendingDown, FileText, Plus, X, Save,
  Download, Printer, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  Clock, Search, ChevronDown, Edit3, Trash2, Eye, RefreshCw,
  Calendar, Users, BarChart2, ArrowUp, ArrowDown, Building2,
  Receipt, BookOpen, FileSpreadsheet, Calculator, Zap
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import type { DashboardProps } from './types';

type Props = DashboardProps;

// ─── Types ────────────────────────────────────────────────────────────────────
type DebtType  = 'receivable' | 'payable';
type DebtStatus= 'current' | 'overdue' | 'partial' | 'paid';
type TaxType   = 'vat_in' | 'vat_out' | 'pit' | 'cit';

interface DebtItem {
  id: string; name: string; type: DebtType; category: string;
  total: number; paid: number; status: DebtStatus;
  dueDate: string; invoiceNo: string; description: string;
  contact: string; overdueDays?: number;
}
interface TaxEntry {
  id: string; type: TaxType; period: string; description: string;
  taxBase: number; taxRate: number; taxAmount: number;
  status: 'declared' | 'paid' | 'pending'; dueDate: string;
}
interface CashFlowEntry { month: string; inflow: number; outflow: number; net: number; cumulative: number; }

const DEBT_STATUS: Record<DebtStatus,{label:string;cls:string;dot:string}> = {
  current:  { label:'Trong hạn',  cls:'bg-emerald-100 text-emerald-700', dot:'bg-emerald-500' },
  overdue:  { label:'Quá hạn',    cls:'bg-rose-100 text-rose-700',       dot:'bg-rose-500 animate-pulse' },
  partial:  { label:'Một phần',   cls:'bg-amber-100 text-amber-700',     dot:'bg-amber-500'   },
  paid:     { label:'Đã thanh toán',cls:'bg-slate-100 text-slate-500',   dot:'bg-slate-400'   },
};
const TAX_TYPE_CFG: Record<TaxType,{label:string;cls:string}> = {
  vat_in:  { label:'VAT đầu vào',  cls:'bg-blue-100 text-blue-700'      },
  vat_out: { label:'VAT đầu ra',   cls:'bg-indigo-100 text-indigo-700'  },
  pit:     { label:'TNCN',         cls:'bg-amber-100 text-amber-700'    },
  cit:     { label:'TNDN',         cls:'bg-violet-100 text-violet-700'  },
};
const COLORS4 = ['#10b981','#3b82f6','#f59e0b','#8b5cf6'];

// ─── Mock data ────────────────────────────────────────────────────────────────
const INIT_DEBTS: DebtItem[] = [
  { id:'d1', name:'CĐT Hoàng Long Group', type:'receivable', category:'Thanh toán hợp đồng', total:28.5, paid:17.2, status:'current', dueDate:'31/03/2026', invoiceNo:'INV-2026/003', description:'Thanh toán đợt 3 theo tiến độ tầng hầm hoàn thành', contact:'Phòng Tài chính: 028-3823-XXXX' },
  { id:'d2', name:'NTP Phát Đạt (thép)', type:'payable', category:'Vật tư & thiết bị', total:4.8, paid:2.4, status:'overdue', dueDate:'28/02/2026', invoiceNo:'PO-2026/015', description:'Thép D16, D20 — 120 tấn. Hóa đơn GTGT số 0012345', contact:'Kinh doanh: 0912-XXX-XXX', overdueDays:7 },
  { id:'d3', name:'NTP Bê tông Hà Thành', type:'payable', category:'Vật tư & thiết bị', total:3.2, paid:3.2, status:'paid', dueDate:'15/02/2026', invoiceNo:'PO-2026/010', description:'Bê tông thương phẩm C30/37 — 450m³', contact:'KD: 0908-XXX-XXX' },
  { id:'d4', name:'TVGS Alpha Engineering', type:'payable', category:'Dịch vụ tư vấn', total:1.2, paid:0.6, status:'partial', dueDate:'31/03/2026', invoiceNo:'PO-2026/008', description:'Phí giám sát tháng 2-3/2026', contact:'Kế toán: 028-XXXX' },
  { id:'d5', name:'NTP Cốp pha Minh Đức', type:'payable', category:'Thiết bị thuê', total:0.85, paid:0, status:'current', dueDate:'15/03/2026', invoiceNo:'PO-2026/019', description:'Thuê cốp pha 3.000m² tháng 3/2026', contact:'KD: 0932-XXX-XXX' },
  { id:'d6', name:'Bảo lãnh dự thầu (hoàn trả)', type:'receivable', category:'Bảo lãnh', total:0.5, paid:0, status:'current', dueDate:'30/04/2026', invoiceNo:'BL-2026/001', description:'Bảo lãnh dự thầu BIDV hoàn trả sau khi ký HĐ chính thức', contact:'BIDV Chi nhánh Q1' },
];
const INIT_TAXES: TaxEntry[] = [
  { id:'t1', type:'vat_out', period:'T2/2026', description:'GTGT đầu ra — Thanh toán đợt 2 CĐT Hoàng Long', taxBase:14.5, taxRate:10, taxAmount:1.45, status:'declared', dueDate:'20/03/2026' },
  { id:'t2', type:'vat_in',  period:'T2/2026', description:'GTGT đầu vào — NTP thép, bê tông, nhân công', taxBase:8.2,  taxRate:10, taxAmount:0.82, status:'declared', dueDate:'20/03/2026' },
  { id:'t3', type:'pit',     period:'T2/2026', description:'Thuế TNCN khấu trừ lương nhân viên tháng 2', taxBase:3.8,  taxRate:5,  taxAmount:0.19, status:'paid',     dueDate:'10/03/2026' },
  { id:'t4', type:'vat_out', period:'T1/2026', description:'GTGT đầu ra — Thanh toán đợt 1 CĐT Hoàng Long', taxBase:12.3, taxRate:10, taxAmount:1.23, status:'paid',     dueDate:'20/02/2026' },
  { id:'t5', type:'vat_in',  period:'T1/2026', description:'GTGT đầu vào — Tổng hợp NTP tháng 1', taxBase:6.1,  taxRate:10, taxAmount:0.61, status:'paid',     dueDate:'20/02/2026' },
  { id:'t6', type:'cit',     period:'Q4/2025', description:'Tạm nộp thuế TNDN quý 4/2025', taxBase:12.0, taxRate:20, taxAmount:2.4, status:'paid',     dueDate:'30/01/2026' },
];
const CASHFLOW: CashFlowEntry[] = [
  { month:'T10/25', inflow:8.2,  outflow:5.8,  net:2.4,  cumulative:2.4  },
  { month:'T11/25', inflow:4.5,  outflow:7.2,  net:-2.7, cumulative:-0.3 },
  { month:'T12/25', inflow:12.3, outflow:6.9,  net:5.4,  cumulative:5.1  },
  { month:'T1/26',  inflow:3.8,  outflow:8.1,  net:-4.3, cumulative:0.8  },
  { month:'T2/26',  inflow:14.5, outflow:9.4,  net:5.1,  cumulative:5.9  },
  { month:'T3/26*', inflow:6.0,  outflow:10.2, net:-4.2, cumulative:1.7  },
  { month:'T4/26*', inflow:15.0, outflow:8.5,  net:6.5,  cumulative:8.2  },
];

const VAT_NET = +(INIT_TAXES.filter(t=>t.period==='T2/2026').reduce((s,t)=>{
  if(t.type==='vat_out') return s+t.taxAmount;
  if(t.type==='vat_in')  return s-t.taxAmount;
  return s;
},0)).toFixed(2);

const GEM_ACC_SYS = `Bạn là GEM — chuyên gia kế toán xây dựng và tư vấn thuế. Xưng "em", gọi "Anh/Chị". Phân tích tình hình công nợ và thuế ngắn gọn, súc tích, đưa ra cảnh báo rủi ro và khuyến nghị cụ thể. Lưu ý: em không cung cấp tư vấn pháp lý chính thức.`;

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300";
const CFTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p:any,i:number)=>(
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{background:p.color}}/><span className="text-slate-500">{p.name}:</span>
          <span className="font-bold" style={{color:p.color}}>{p.value > 0 ? '+':''}{p.value.toFixed(1)} tỷ</span>
        </div>
      ))}
    </div>
  );
};


// ── DebtPrint — modal in phiếu công nợ ────────────────────────────────────────
function DebtPrint({ data, onClose }: {
  data: { debt: DebtItem; projectName: string; projectId: string };
  onClose: () => void;
}) {
  const { debt, projectName } = data;
  const remaining = debt.total - debt.paid;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-slate-800">PHIẾU CÔNG NỢ</h2>
            <p className="text-xs text-slate-500 mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={16}/></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-400 text-xs">Đối tác:</span><p className="font-semibold text-slate-800">{debt.name}</p></div>
            <div><span className="text-slate-400 text-xs">Loại:</span><p className="font-semibold">{debt.type==='receivable'?'Phải thu':'Phải trả'}</p></div>
            <div><span className="text-slate-400 text-xs">Số hoá đơn:</span><p className="font-mono text-sm">{debt.invoiceNo}</p></div>
            <div><span className="text-slate-400 text-xs">Hạn thanh toán:</span><p className="font-semibold text-rose-600">{debt.dueDate}</p></div>
            <div><span className="text-slate-400 text-xs">Tổng giá trị:</span><p className="font-bold text-slate-800">{debt.total.toFixed(2)} tỷ</p></div>
            <div><span className="text-slate-400 text-xs">Đã thanh toán:</span><p className="font-bold text-emerald-700">{debt.paid.toFixed(2)} tỷ</p></div>
          </div>
          <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 text-center">
            <p className="text-xs text-rose-500 font-semibold uppercase tracking-wide">Còn lại phải {debt.type==='receivable'?'thu':'trả'}</p>
            <p className="text-2xl font-black text-rose-700 mt-1">{remaining.toFixed(2)} tỷ đồng</p>
          </div>
          {debt.description && <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">{debt.description}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={()=>window.print()} className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 flex items-center justify-center gap-2">
              <Printer size={14}/>In phiếu
            </button>
            <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TaxTablePrint — modal in bảng kê thuế ─────────────────────────────────────
function TaxTablePrint({ data, onClose }: {
  data: {
    taxes: { period: string; type: string; description: string; base: number; rate: number; taxAmount: number; status: string; dueDate: string }[];
    projectName: string; projectId: string; period: string;
  };
  onClose: () => void;
}) {
  const { taxes, projectName, period } = data;
  const totalTax = taxes.reduce((s,t) => s + t.taxAmount, 0);
  const TAX_LABELS: Record<string,string> = {
    vat_out:'VAT đầu ra', vat_in:'VAT đầu vào', cit:'Thuế TNDN',
    pit:'Thuế TNCN', pit_contractor:'Thuế TNCN thầu phụ', other:'Khác',
  };
  const STATUS_CLS: Record<string,string> = {
    declared:'bg-amber-100 text-amber-700',
    paid:'bg-emerald-100 text-emerald-700',
    pending:'bg-slate-100 text-slate-600',
  };
  const STATUS_LBL: Record<string,string> = { declared:'Đã kê khai', paid:'Đã nộp', pending:'Chờ kê khai' };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-800">BẢNG KÊ THUẾ</h2>
            <p className="text-xs text-slate-500 mt-0.5">{projectName} · Kỳ: {period}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={16}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {['Kỳ','Loại thuế','Mô tả','Căn cứ tính','Thuế suất','Số thuế','Hạn nộp','Trạng thái'].map(h=>(
                    <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-500 uppercase text-[10px] border-b border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taxes.map((t,i)=>(
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-700">{t.period}</td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md font-semibold">{TAX_LABELS[t.type]||t.type}</span></td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[180px] truncate">{t.description}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{(t.base/1e9).toFixed(2)}B</td>
                    <td className="px-3 py-2.5 text-center">{(t.rate*100).toFixed(0)}%</td>
                    <td className="px-3 py-2.5 text-right font-bold text-rose-700">{(t.taxAmount/1e9).toFixed(3)}B</td>
                    <td className="px-3 py-2.5 text-slate-500">{t.dueDate}</td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_CLS[t.status]||''}`}>{STATUS_LBL[t.status]||t.status}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td colSpan={5} className="px-3 py-3 font-black text-slate-700 text-right text-sm">TỔNG THUẾ</td>
                  <td className="px-3 py-3 font-black text-rose-700 text-right text-sm">{(totalTax/1e9).toFixed(3)}B</td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>window.print()} className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 flex items-center justify-center gap-2">
              <Printer size={14}/>In bảng kê
            </button>
            <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountingDashboard({ project, projectId }: Props) {
  const pid            = projectId ?? project?.id ?? 'p1';
  const projName       = project?.name ?? 'Dự án';
  const ctx            = getCurrentCtx(pid);
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [approvalPending, setApprovalPending] = useState(() =>
    getApprovalQueue(pid, ctx).length
  );
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [accApprovalQueue, setAccApprovalQueue] = useState<ApprovalDoc[]>(() => getApprovalQueue(pid, ctx));

  const refreshAccQueue = useCallback(() => {
    const q = getApprovalQueue(pid, ctx);
    setAccApprovalQueue(q);
    setApprovalPending(q.length);
  }, [pid]);

  const [tab, setTab] = useState<'debt'|'tax'|'cashflow'>('debt');
  const [printDebt, setPrintDebt] = useState<any>(null);
  const [printTax, setPrintTax] = useState<boolean>(false);
  const [debts, setDebts] = useState<DebtItem[]>(INIT_DEBTS);
  const [taxes] = useState<TaxEntry[]>(INIT_TAXES);
  const [debtFilter, setDebtFilter] = useState<'all'|DebtType>('all');
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [debtForm, setDebtForm] = useState<Partial<DebtItem & {type: string}>>({});
  const [gemLoading, setGemLoading] = useState(false);
  const [gemText, setGemText] = useState('');
  const [showGem, setShowGem] = useState(false);
  // ── Liên thông MaterialsDashboard: Load chứng từ đã duyệt ─────────────────
  const [matVouchers, setMatVouchers] = useState<any[]>([]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      // Load chứng từ vật tư đã approved từ MaterialsDashboard
      const vouchers = await db.get('mat_vouchers', projectId, []) as any[];
      const approved = vouchers.filter((v: any) => v.status === 'approved');
      setMatVouchers(approved);

      // ── Liên thông QSDashboard: Load đề nghị thanh toán đã approved ────────
      const qsPayments = await db.get<any[]>('qs_payments', projectId, []);
      const qsApproved = qsPayments.filter((p: any) => p.status === 'approved' || p.status === 'paid');
      const qsDebts = qsApproved.map((p: any) => ({
        id: `qs-${p.id}`,
        name: 'Chủ đầu tư (QS)',
        type: 'receivable' as const,
        category: 'Thanh toán công trình',
        total: +((p.net_payable || p.total || 0) / 1e9).toFixed(3),
        paid: p.status === 'paid' ? +((p.net_payable || p.total || 0) / 1e9).toFixed(3) : 0,
        status: (p.status === 'paid' ? 'paid' : 'current') as any,
        dueDate: p.date || '--/--/----',
        invoiceNo: p.request_no || p.id,
        description: `${p.request_no} — ${p.period || 'Đề nghị thanh toán'}`,
        contact: 'Xem tab QS',
      }));

      // Load debts từ db (nếu có), fallback về INIT_DEBTS
      const savedDebts = await db.get('acc_debts', projectId, []) as any[];
      if (savedDebts.length) setDebts(savedDebts);

      // Tự động tạo công nợ từ PN approved (mat_vouchers trực tiếp)
      const matDebtsFromVouchers = approved
        .filter((v: any) => v.type === 'PN' && !v.accDebtCreated)
        .map((v: any) => ({
          id: `mat-${v.id}`,
          name: v.nhaCungCap || v.supplier || 'NTP Vật tư',
          type: 'payable' as DebtType,
          category: 'Vật tư & thiết bị',
          total: +((v.totalAmount || v.items?.reduce((s: number, i: any) => s + (i.thanhTien || 0), 0) || v.tongTien || v.totalValue || 0) / 1e9).toFixed(3),
          paid: 0,
          status: 'current' as DebtStatus,
          dueDate: v.ngay || v.date || '--/--/----',
          invoiceNo: v.soPhieu || v.code || v.id,
          description: `Phiếu nhập kho ${v.soPhieu || v.id} — đã duyệt qua Vật tư`,
          contact: 'Xem tab Vật tư',
        }));

      // Seed ApprovalEngine từ vouchers đã approved (idempotent)
      const docTypeMap: Record<string, any> = { PN:'WAREHOUSE_ENTRY', PX:'WAREHOUSE_EXIT', VAT:'FINANCIAL_VOUCHER', KK:'FINANCIAL_VOUCHER' };
      const seedInputs: SeedVoucherInput[] = approved.map((v: any) => ({
        voucherId:    v.id,
        voucherCode:  v.code,
        docType:      docTypeMap[v.type] || 'WAREHOUSE_EXIT',
        title:        `${v.type === 'PN' ? 'Phiếu Nhập Kho' : 'Chứng từ'} — ${v.nhaCungCap || v.nguoiLap || v.code}`,
        amount:       v.totalAmount || v.items?.reduce((s: number, i: any) => s + (i.thanhTien || 0), 0) || 0,
        voucherData:  v,
        legacyStatus: 'approved' as const,
      }));
      seedApprovalDocs(projectId, seedInputs);

      // Đọc thêm từ ApprovalEngine — docs COMPLETED loại WAREHOUSE_ENTRY
      const adminCtx = createLegacyContext('giam_doc', 'accounting_sync');
      const engineDocs = getAllDocs(projectId, adminCtx)
        .filter(d =>
          (d.docType === 'WAREHOUSE_ENTRY' || d.docType === 'FINANCIAL_VOUCHER') &&
          (d.status === 'COMPLETED' || d.status === 'APPROVED')
        );

      const matDebtsFromEngine = engineDocs
        .map(d => ({
          id: `eng-${d.id}`,
          name: (d.data as any)?.voucher?.nhaCungCap || d.createdByName || 'NTP',
          type: 'payable' as DebtType,
          category: d.docType === 'WAREHOUSE_ENTRY' ? 'Vật tư & thiết bị' : 'Chi phí khác',
          total: +((d.amount || 0) / 1e9).toFixed(3),
          paid: 0,
          status: 'current' as DebtStatus,
          dueDate: d.updatedAt?.slice(0,10) || '--/--/----',
          invoiceNo: d.docNumber,
          description: `${d.title} — duyệt ${d.updatedAt?.slice(0,10)}`,
          contact: 'Xem tab Phê duyệt',
        }));

      const allNewDebts = [...matDebtsFromVouchers, ...matDebtsFromEngine, ...qsDebts];
      if (allNewDebts.length) {
        setDebts(prev => {
          const existingIds = new Set(prev.map((d: any) => d.id));
          const newOnes = allNewDebts.filter((d: any) => !existingIds.has(d.id));
          return newOnes.length ? [...prev, ...newOnes] : prev;
        });
      }
    })();
  }, [projectId]);

  // ── Realtime sync — reload khi mat_vouchers hoặc qs_payments thay đổi ────
  useRealtimeSync(projectId ?? pid, ['mat_vouchers', 'qs_payments', 'acc_debts'], async () => {
    const _pid = projectId ?? pid;
    const vouchers = await db.get('mat_vouchers', _pid, []) as any[];
    const approved = vouchers.filter((v: any) => v.status === 'approved');
    setMatVouchers(approved);
    const qsPayments = await db.get<any[]>('qs_payments', _pid, []);
    const qsApproved = qsPayments.filter((p: any) => p.status === 'approved' || p.status === 'paid');
    const qsDebts = qsApproved.map((p: any) => ({
      id: `qs-${p.id}`,
      name: 'Chủ đầu tư (QS)',
      type: 'receivable' as const,
      category: 'Thanh toán công trình',
      total: +((p.net_payable || p.total || 0) / 1e9).toFixed(3),
      paid: p.status === 'paid' ? +((p.net_payable || p.total || 0) / 1e9).toFixed(3) : 0,
      status: (p.status === 'paid' ? 'paid' : 'current') as any,
      dueDate: p.date || '--/--/----',
      invoiceNo: p.request_no || p.id,
      description: `${p.request_no} — ${p.period || 'Đề nghị thanh toán'}`,
      contact: 'Xem tab QS',
    }));
    const savedDebts = await db.get('acc_debts', _pid, []) as any[];
    setDebts(prev => {
      const base = savedDebts.length ? savedDebts : prev;
      const existingIds = new Set(base.map((d: any) => d.id));
      const newOnes = qsDebts.filter((d: any) => !existingIds.has(d.id));
      return newOnes.length ? [...base, ...newOnes] : base;
    });
  });

  // Persist debts khi thay đổi
  useEffect(() => {
    if (projectId) db.set('acc_debts', projectId, debts);
  }, [debts, projectId]);


  const totalReceivable = debts.filter(d=>d.type==='receivable').reduce((s,d)=>s+(d.total-d.paid),0);
  const totalPayable    = debts.filter(d=>d.type==='payable').reduce((s,d)=>s+(d.total-d.paid),0);
  const overdueItems    = debts.filter(d=>d.status==='overdue');
  const taxDue          = taxes.filter(t=>t.status==='declared').reduce((s,t)=>s+t.taxAmount,0);

  const filtered = debts.filter(d => debtFilter==='all' || d.type===debtFilter);

  const callGEM = useCallback(async () => {
    setGemLoading(true); setGemText(''); setShowGem(true);
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL, systemInstruction: GEM_ACC_SYS });
      const matSummary = matVouchers.length ? `\nChứng từ vật tư đã duyệt: ${matVouchers.length} phiếu — tổng giá trị: ${(matVouchers.reduce((s:any,v:any)=>s+(v.totalValue||0),0)/1e9).toFixed(2)} tỷ` : '';
      const r = await model.generateContent(
        `Phân tích tình hình tài chính dự án ${project?.name||'Villa PAT'}:\n` +
        `Công nợ phải thu: ${totalReceivable.toFixed(1)} tỷ | Công nợ phải trả: ${totalPayable.toFixed(1)} tỷ\n` +
        `Hạng mục quá hạn: ${overdueItems.map(d=>`${d.name} (${d.overdueDays||0} ngày, ${(d.total-d.paid).toFixed(1)} tỷ)`).join(', ')||'Không có'}\n` +
        `Thuế cần nộp: ${taxDue.toFixed(2)} tỷ | VAT T2/2026 phải nộp: ${VAT_NET.toFixed(2)} tỷ\n` +
        `Dòng tiền T3/2026 dự báo: +6.0 vào / -10.2 ra = -4.2 tỷ` + matSummary + `\n\n` +
        `Phân tích: (1) Tình hình công nợ tổng thể, (2) Rủi ro thanh khoản, (3) Nghĩa vụ thuế sắp đến hạn, (4) Khuyến nghị ưu tiên xử lý.`
      );
      setGemText(r.response.text());
    } catch { setGemText('❌ Không kết nối GEM.'); }
    setGemLoading(false);
  }, [debts, taxes, totalReceivable, totalPayable, overdueItems, taxDue, project]);

  const tabs = [
    { id:'debt'     as const, label:'Sổ công nợ',       icon:<BookOpen size={14}/>    },
    { id:'tax'      as const, label:'Báo cáo thuế',     icon:<Receipt size={14}/>     },
    { id:'cashflow' as const, label:'Dự báo dòng tiền', icon:<TrendingUp size={14}/> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calculator size={20} className="text-teal-600"/> Kế toán & Tài chính — {project?.name||'Dự án'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Công nợ phải thu/trả · Bảng kê thuế GTGT · Dự báo dòng tiền</p>
        </div>
        <button onClick={callGEM} disabled={gemLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 shadow-sm">
          {gemLoading?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>} GEM phân tích
        </button>
      </div>

      {/* GEM panel */}
      {showGem && (
        <div className="bg-gradient-to-br from-teal-900 to-emerald-900 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-teal-100 flex items-center gap-2"><Sparkles size={14} className="text-teal-300"/>Nàng GEM — Phân tích tài chính</span>
            <button onClick={()=>setShowGem(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={14}/></button>
          </div>
          {gemLoading?<div className="flex items-center gap-2 text-teal-200"><Loader2 size={14} className="animate-spin"/>Đang phân tích...</div>
            :<pre className="text-sm text-teal-100 whitespace-pre-wrap leading-relaxed font-sans">{gemText}</pre>}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Phải thu còn lại',  val:`${totalReceivable.toFixed(1)} tỷ`, icon:<ArrowUp size={16}/>,   cls:'bg-emerald-100 text-emerald-700', sub:`${debts.filter(d=>d.type==='receivable'&&d.status!=='paid').length} khoản` },
          { label:'Phải trả còn lại',  val:`${totalPayable.toFixed(1)} tỷ`,    icon:<ArrowDown size={16}/>, cls:'bg-rose-100 text-rose-700',       sub:`${debts.filter(d=>d.type==='payable'&&d.status!=='paid').length} khoản` },
          { label:'Quá hạn',           val:overdueItems.length,                 icon:<AlertTriangle size={16}/>,cls:overdueItems.length>0?'bg-rose-200 text-rose-800':'bg-slate-100 text-slate-600', sub:`${overdueItems.reduce((s,d)=>s+(d.total-d.paid),0).toFixed(1)} tỷ` },
          { label:'Thuế chờ nộp',      val:`${taxDue.toFixed(2)} tỷ`,          icon:<Receipt size={16}/>,   cls:'bg-amber-100 text-amber-700',    sub:`VAT T2: ${VAT_NET.toFixed(2)} tỷ` },
        ].map((k,i)=>(
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}>{k.icon}</div>
            <div className="text-xl font-black text-slate-800">{k.val}</div>
            <div className="text-xs text-slate-400 mt-0.5">{k.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {overdueItems.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={17} className="text-rose-500 mt-0.5 shrink-0"/>
          <div className="flex-1">
            <p className="font-bold text-rose-800 text-sm">{overdueItems.length} khoản công nợ quá hạn — cần xử lý ngay</p>
            {overdueItems.map(d=>(
              <p key={d.id} className="text-xs text-rose-700 mt-0.5">
                • <strong>{d.name}</strong> — {(d.total-d.paid).toFixed(1)} tỷ, quá {d.overdueDays} ngày (HĐ {d.invoiceNo})
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tabs + approval badge */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t.id?'bg-white shadow-sm text-teal-700':'text-slate-500 hover:text-slate-700'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowApprovalPanel(true)}
          className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 transition-all">
          <ClipboardList size={13}/> Hàng duyệt KT
          {accApprovalQueue.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {accApprovalQueue.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Debt Ledger ──────────────────────────────────────────────────────── */}
      {tab==='debt' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              {(['all','receivable','payable'] as const).map(f=>(
                <button key={f} onClick={()=>setDebtFilter(f)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${debtFilter===f?'bg-teal-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f==='all'?'Tất cả':f==='receivable'?'📥 Phải thu':'📤 Phải trả'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => {
                const amount = debts.filter(d=>d.status!=='paid').reduce((s,d)=>s+(d.total-d.paid),0) * 1e9;
                const _title = `Phiếu thu chi tháng ${new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })} — ${projName}`;
                const _cr = createDocument({ projectId: pid, docType: 'FINANCIAL_VOUCHER', ctx, title: _title, amount, data: { ref: `FV-${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}` } });
                if (_cr.ok) { engineSubmitDoc(pid, _cr.data!.id, ctx); refreshAccQueue(); }
                notifOk('Phiếu thu chi đã gửi duyệt!');
              }} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold">
                Gửi duyệt phiếu {approvalPending > 0 && <span className="bg-white/30 px-1.5 rounded-full text-xs">{approvalPending}</span>}
              </button>
              <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
                <Plus size={14}/> Thêm công nợ
              </button>
            </div>
          </div>

          {/* Debt pie */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              {filtered.map(debt=>{
                const st = DEBT_STATUS[debt.status]; const isExp = expandedId===debt.id;
                const remaining = debt.total - debt.paid; const pct = debt.total>0?(debt.paid/debt.total*100):0;
                return (
                  <div key={debt.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${debt.status==='overdue'?'border-rose-200':debt.status==='partial'?'border-amber-200':'border-slate-200'}`}>
                    <div className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50" onClick={()=>setExpandedId(isExp?null:debt.id)}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${debt.type==='receivable'?'bg-emerald-100':'bg-rose-100'}`}>
                        {debt.type==='receivable'?<ArrowUp size={16} className="text-emerald-600"/>:<ArrowDown size={16} className="text-rose-600"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${st.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{debt.category}</span>
                          {debt.status==='overdue'&&<span className="text-[10px] font-black text-rose-700 animate-pulse">+{debt.overdueDays} NGÀY</span>}
                        </div>
                        <p className="text-sm font-bold text-slate-800">{debt.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex-1">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct>=100?'bg-emerald-400':pct>50?'bg-amber-400':'bg-rose-400'}`} style={{width:`${pct}%`}}/>
                            </div>
                          </div>
                          <span className="text-xs font-black text-slate-700 whitespace-nowrap">{remaining.toFixed(1)} / {debt.total.toFixed(1)} tỷ</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">HĐ: {debt.invoiceNo} · Hạn: {debt.dueDate}</p>
                      </div>
                      <ChevronDown size={13} className={`text-slate-400 transition-transform shrink-0 mt-1 ${isExp?'rotate-180':''}`}/>
                    </div>
                    {isExp && (
                      <div className="border-t border-slate-100 p-4 space-y-3">
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wide">Mô tả</p>
                            <p className="text-xs text-slate-700">{debt.description}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wide">Liên hệ thanh toán</p>
                            <p className="text-xs text-slate-700">{debt.contact}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          {[['Giá trị HĐ',`${debt.total.toFixed(2)} tỷ`],['Đã thanh toán',`${debt.paid.toFixed(2)} tỷ`],['Còn lại',`${remaining.toFixed(2)} tỷ`]].map(([l,v])=>(
                            <div key={l} className="bg-slate-50 rounded-xl p-2">
                              <p className="text-[9px] text-slate-400 uppercase mb-0.5">{l}</p>
                              <p className="text-sm font-black text-slate-800">{v}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          {debt.status!=='paid'&&<button onClick={()=>setDebts(p=>p.map(d=>d.id===debt.id?{...d,paid:d.total,status:'paid' as DebtStatus}:d))} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100"><CheckCircle2 size={10}/>Thanh toán đủ</button>}
                          <button onClick={() => setPrintDebt(debt)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"><Printer size={10}/>In phiếu</button>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"><Download size={10}/>Xuất Excel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary pie */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wide">Cơ cấu công nợ (tỷ VNĐ)</p>
                <ResponsiveContainer width="100%" height={160} minWidth={0}>
                  <PieChart>
                    <Pie data={[
                      { name:'Phải thu', value:+totalReceivable.toFixed(1) },
                      { name:'Phải trả', value:+totalPayable.toFixed(1) },
                    ]} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={4}>
                      {[0,1].map(i=><Cell key={i} fill={['#10b981','#ef4444'][i]}/>)}
                    </Pie>
                    <Tooltip formatter={(v:any)=>`${v} tỷ`}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {[['#10b981','Phải thu',totalReceivable],['#ef4444','Phải trả',totalPayable]].map(([c,l,v]:any)=>(
                    <div key={l} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>{l}</span>
                      <span className="font-bold">{v.toFixed(1)} tỷ</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide">Cấu trúc phải trả theo danh mục</p>
                {['Vật tư & thiết bị','Dịch vụ tư vấn','Thiết bị thuê'].map(cat=>{
                  const total = debts.filter(d=>d.type==='payable'&&d.category===cat).reduce((s,d)=>s+(d.total-d.paid),0);
                  return total>0?(
                    <div key={cat} className="mb-2">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-0.5"><span>{cat}</span><span>{total.toFixed(1)} tỷ</span></div>
                      <div className="h-1.5 bg-slate-100 rounded-full"><div className="h-full bg-rose-400 rounded-full" style={{width:`${(total/totalPayable)*100}%`}}/></div>
                    </div>
                  ):null;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tax Report ───────────────────────────────────────────────────────── */}
      {tab==='tax' && (
        <div className="space-y-4">
          {/* VAT summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Receipt size={15} className="text-amber-600"/>Bảng kê thuế GTGT tháng 2/2026</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label:'VAT đầu ra', val:`${INIT_TAXES.filter(t=>t.type==='vat_out'&&t.period==='T2/2026').reduce((s,t)=>s+t.taxAmount,0).toFixed(2)} tỷ`, cls:'bg-indigo-50 border-indigo-200 text-indigo-800' },
                { label:'VAT đầu vào', val:`${INIT_TAXES.filter(t=>t.type==='vat_in'&&t.period==='T2/2026').reduce((s,t)=>s+t.taxAmount,0).toFixed(2)} tỷ`, cls:'bg-blue-50 border-blue-200 text-blue-800' },
                { label:'VAT phải nộp', val:`${VAT_NET.toFixed(2)} tỷ`, cls:`${VAT_NET>0?'bg-rose-50 border-rose-200 text-rose-800':'bg-emerald-50 border-emerald-200 text-emerald-800'} font-black` },
              ].map((k,i)=>(
                <div key={i} className={`p-3 rounded-2xl border-2 ${k.cls} text-center`}>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{k.label}</div>
                  <div className="text-xl font-black">{k.val}</div>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <strong>📅 Hạn nộp:</strong> 20/03/2026 — VAT tháng 2 phải nộp <strong>{VAT_NET.toFixed(2)} tỷ</strong> (còn {Math.max(0,13)} ngày).
              Cần chuẩn bị: Bảng kê hóa đơn đầu vào/ra, tờ khai 01/GTGT, nộp qua HTKK.
            </div>
          </div>

          {/* Tax table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet size={15} className="text-slate-500"/>Sổ theo dõi nghĩa vụ thuế</h3>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100"><Download size={10}/>Xuất Excel</button>
                <button onClick={() => setPrintTax(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"><Printer size={10}/>In bảng kê</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Kỳ','Loại thuế','Mô tả','Căn cứ tính thuế','Thuế suất','Số thuế','Trạng thái','Hạn nộp'].map(h=>(
                      <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taxes.map(t=>(
                    <tr key={t.id} className={`hover:bg-slate-50 ${t.status==='pending'?'bg-amber-50/30':''}`}>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-600">{t.period}</td>
                      <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TAX_TYPE_CFG[t.type].cls}`}>{TAX_TYPE_CFG[t.type].label}</span></td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[200px] truncate">{t.description}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{t.taxBase.toFixed(2)} tỷ</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-600">{t.taxRate}%</td>
                      <td className="px-3 py-2.5 text-right font-black text-slate-800">{t.taxAmount.toFixed(2)} tỷ</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status==='paid'?'bg-emerald-100 text-emerald-700':t.status==='declared'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}`}>
                          {t.status==='paid'?'Đã nộp':t.status==='declared'?'Đã khai, chờ nộp':'Chưa khai'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{t.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-slate-600 uppercase">Tổng nghĩa vụ thuế chờ nộp</td>
                    <td className="px-3 py-2.5 text-right font-black text-rose-700">{taxDue.toFixed(2)} tỷ</td>
                    <td colSpan={2}/>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Cash Flow ──────────────────────────────────────────────────────────── */}
      {tab==='cashflow' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={15} className="text-teal-600"/>Dự báo dòng tiền — 7 tháng</h3>
              <div className="flex gap-3 text-[10px] font-semibold">
                {[['#10b981','Thu'],['#ef4444','Chi'],['#3b82f6','Tích lũy']].map(([c,l])=>(
                  <span key={l} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background:c}}/>{l}</span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <BarChart data={CASHFLOW} margin={{top:5,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}tỷ`} width={44}/>
                <Tooltip content={<CFTooltip/>}/>
                <Bar dataKey="inflow"  name="Thu vào" fill="#10b981" radius={[4,4,0,0]}/>
                <Bar dataKey="outflow" name="Chi ra"   fill="#ef4444" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><BarChart2 size={15} className="text-blue-600"/>Dòng tiền tích lũy</h3>
            <ResponsiveContainer width="100%" height={200} minWidth={0}>
              <LineChart data={CASHFLOW} margin={{top:5,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}tỷ`} width={44}/>
                <Tooltip content={<CFTooltip/>}/>
                <Line type="monotone" dataKey="cumulative" name="Tích lũy" stroke="#3b82f6" strokeWidth={2.5} dot={{r:4,fill:'#3b82f6'}}/>
                <Line type="monotone" dataKey="net" name="Net tháng" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={{r:3}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {CASHFLOW.slice(-3).map(m=>(
              <div key={m.month} className={`p-4 rounded-2xl border-2 ${m.net>=0?'bg-emerald-50 border-emerald-200':'bg-rose-50 border-rose-200'}`}>
                <p className="text-xs font-bold text-slate-500 mb-1">{m.month}{m.month.includes('*')&&' (dự báo)'}</p>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-emerald-600 font-semibold">↑ {m.inflow} tỷ</span>
                  <span className="text-rose-600 font-semibold">↓ {m.outflow} tỷ</span>
                </div>
                <p className={`text-xl font-black ${m.net>=0?'text-emerald-700':'text-rose-700'}`}>{m.net>=0?'+':''}{m.net.toFixed(1)} tỷ</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Tích lũy: {m.cumulative.toFixed(1)} tỷ</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ModalForm
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Thêm công nợ mới"
        subtitle="Ghi nhận khoản phải thu / phải trả"
        icon={<DollarSign size={18}/>}
        color="teal"
        width="md"
        footer={<>
          <BtnCancel onClick={() => setShowForm(false)}/>
          <BtnSubmit label="Lưu công nợ" onClick={() => {
            if (!debtForm.name?.trim())  { notifErr('Vui lòng nhập tên đối tác!'); return; }
            if (!debtForm.total || debtForm.total <= 0) { notifErr('Vui lòng nhập giá trị công nợ!'); return; }
            const newDebt: DebtItem = {
              id: 'debt_' + Date.now(),
              name: debtForm.name!,
              type: debtForm.type as DebtType ?? 'payable',
              category: debtForm.category ?? 'Chi phí khác',
              total: debtForm.total!,
              paid: 0,
              status: 'current' as DebtStatus,
              dueDate: debtForm.dueDate ?? '--/--/----',
              invoiceNo: debtForm.invoiceNo ?? '',
              description: debtForm.description ?? '',
              contact: debtForm.contact ?? '',
            };
            setDebts(prev => {
              const next = [newDebt, ...prev];
              if (pid) db.set('acc_debts', pid, next);
              return next;
            });
            setDebtForm({});
            setShowForm(false);
            notifOk('Đã thêm công nợ!');
          }}/>
        </>}
      >
        <FormGrid cols={2}>
          <div className="col-span-2"><FormRow label="Tên đối tác *">
            <input className={inputCls} placeholder="VD: NTP Phúc Thành" value={debtForm.name ?? ''} onChange={e => setDebtForm(p => ({...p, name: e.target.value}))}/>
          </FormRow></div>
          <FormRow label="Loại">
            <select className={selectCls} value={debtForm.type ?? 'payable'} onChange={e => setDebtForm(p => ({...p, type: e.target.value as 'receivable' | 'payable'}))}>
              <option value="payable">Phải trả (NTP/NCC)</option>
              <option value="receivable">Phải thu (Chủ đầu tư)</option>
            </select>
          </FormRow>
          <FormRow label="Danh mục">
            <select className={selectCls} value={debtForm.category ?? 'Chi phí khác'} onChange={e => setDebtForm(p => ({...p, category: e.target.value}))}>
              {['Vật tư & thiết bị','Nhân công','Thanh toán công trình','Chi phí khác'].map(c => <option key={c}>{c}</option>)}
            </select>
          </FormRow>
          <FormRow label="Giá trị (tỷ VNĐ) *">
            <input type="number" step="0.001" className={inputCls} placeholder="0.000" value={debtForm.total ?? ''} onChange={e => setDebtForm(p => ({...p, total: +e.target.value}))}/>
          </FormRow>
          <FormRow label="Hạn thanh toán">
            <input className={inputCls} placeholder="DD/MM/YYYY" value={debtForm.dueDate ?? ''} onChange={e => setDebtForm(p => ({...p, dueDate: e.target.value}))}/>
          </FormRow>
          <FormRow label="Số hóa đơn / Hợp đồng">
            <input className={inputCls} placeholder="VD: HĐ-2026/001" value={debtForm.invoiceNo ?? ''} onChange={e => setDebtForm(p => ({...p, invoiceNo: e.target.value}))}/>
          </FormRow>
          <FormRow label="Liên hệ">
            <input className={inputCls} placeholder="Tên / SĐT người phụ trách" value={debtForm.contact ?? ''} onChange={e => setDebtForm(p => ({...p, contact: e.target.value}))}/>
          </FormRow>
          <div className="col-span-2"><FormRow label="Ghi chú">
            <input className={inputCls} value={debtForm.description ?? ''} onChange={e => setDebtForm(p => ({...p, description: e.target.value}))}/>
          </FormRow></div>
        </FormGrid>
      </ModalForm>
      {/* ── APPROVAL QUEUE DRAWER ── */}
      {showApprovalPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowApprovalPanel(false)}/>
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            <ApprovalQueue
              projectId={pid}
              projectName={projName}
              ctx={ctx}
              onClose={() => { setShowApprovalPanel(false); refreshAccQueue(); }}
            />
          </div>
        </div>
      )}

      {printDebt && <DebtPrint
        data={{ debt: printDebt, projectName: projName, projectId: pid }}
        onClose={() => setPrintDebt(null)}
      />}
      {printTax && <TaxTablePrint
        data={{
          taxes: taxes.map(t => ({
            period: t.period,
            type: t.type,
            description: t.description || '',
            base: t.taxBase ?? 0,
            rate: t.taxRate ?? 0,
            taxAmount: t.taxAmount,
            status: t.status,
            dueDate: t.dueDate || '',
          })),
          projectName: projName,
          projectId: pid,
          period: new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }),
        }}
        onClose={() => setPrintTax(false)}
      />}
    </div>
  );
}