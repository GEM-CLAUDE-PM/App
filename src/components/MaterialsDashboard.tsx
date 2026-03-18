import { useNotification } from './NotificationEngine';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import { db, useRealtimeSync } from './db';
import { createDocument, processApproval, submitDocument, verifyPin, seedApprovalDocs, getDocsByType } from './approvalEngine';
import type { SeedVoucherInput, ApprovalDoc } from './approvalEngine';
import { DEFAULT_THRESHOLDS, canActOnStep, WORKFLOWS, ROLES } from './permissions';
import { VoucherPrint, InventoryPrint } from "./PrintService";
import ModalForm, { FormRow, FormGrid, FormSection, inputCls, selectCls, BtnCancel, BtnSubmit, FormFileUpload } from './ModalForm';
import {
  Package, FileText, BarChart2, Plus, Search, AlertTriangle, Pencil, Trash2,
  CheckCircle2, Loader2, Sparkles, X, ChevronDown, ChevronUp,
  Upload, Printer, Save, Eye, Clock, TrendingDown, TrendingUp,
  ShieldAlert, RefreshCw, Filter, ArrowUpDown, Box, Truck,
  ClipboardCheck, Receipt, ScanLine, AlertCircle, CheckSquare,
  ArrowRight, MoreVertical, Tag, Calendar, User, Building2
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
type MatTab = 'kho' | 'dexuat' | 'chungtu' | 'kiemsoat';
type VoucherType = 'PN' | 'PX' | 'VAT' | 'KK';
type VoucherStatus = 'draft' | 'pending' | 'approved' | 'rejected';
type AlertLevel = 'urgent' | 'warning' | 'info';

interface MaterialItem {
  id: string; code: string; name: string; unit: string;
  tonKho: number; threshold: number; maxStock: number;
  donGia: number; // VNĐ
  nhaCungCap: string; viTri: string;
  ngayNhapCuoi: string; ngayXuatCuoi: string;
}
interface MRItem { matHangId: string; tenMatHang: string; donVi: string; soLuong: number; ghiChu: string; }
interface MaterialRequest {
  id: string; code: string; ngay: string;
  nguoiLap: string; nguoiNhan?: string; chucVuNguoiLap?: string;
  hangMuc: string; lyDo: string; canNgay: string;
  uuTien?: 'normal' | 'urgent' | 'critical';
  nccGoiY?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  items: MRItem[]; totalEstimate: number; docId?: string;
}
interface VoucherItem { matHang: string; donVi: string; soLuong: number; donGia: number; thanhTien: number; }
interface Voucher {
  id: string; type: VoucherType; code: string; ngay: string;
  nguoiLap: string; chucVuNguoiLap?: string;
  nguoiNhan?: string; nguoiGiao?: string;
  nguoiDuyet: string; status: VoucherStatus;
  kho?: string; soHoaDon?: string;
  mucDich?: string; phuongTien?: string;
  ghiChu: string; items: VoucherItem[];
  hoaDonVAT?: string; nhaCungCap?: string;
  butToan?: string;
  totalAmount: number;
}
interface KiemKeItem { matHangId: string; tenMatHang: string; donVi: string; soSach: number; thucTe: number; chenhLech: number; ghiChu: string; }
interface KiemKe {
  id: string; ngay: string; nguoiKiemKe: string; nguoiDuyet: string;
  status: VoucherStatus; items: KiemKeItem[]; ghiChu: string;
}
interface MatAlert { id: string; level: AlertLevel; title: string; msg: string; targetTab: MatTab; matHangId?: string; }
import type { DashboardProps } from './types';

type Props = DashboardProps & {
  onAlert?:    (alerts: MatAlert[]) => void;
  currentRole?: string; // legacy — mapped to ctx inside
};

// ── Constants ────────────────────────────────────────────────────────────────
const VOUCHER_TYPE_CFG: Record<VoucherType, { label: string; color: string; bg: string; tk: string }> = {
  PN:  { label: 'Phiếu Nhập Kho',    color: 'text-emerald-700', bg: 'bg-emerald-100', tk: 'Nợ TK152 / Có TK331' },
  PX:  { label: 'Phiếu Xuất Kho',    color: 'text-blue-700',    bg: 'bg-blue-100',    tk: 'Nợ TK621 / Có TK152' },
  VAT: { label: 'Hóa đơn VAT',       color: 'text-violet-700',  bg: 'bg-violet-100',  tk: 'Nợ TK133 / Có TK331' },
  KK:  { label: 'Kiểm kê kho',       color: 'text-amber-700',   bg: 'bg-amber-100',   tk: 'Điều chỉnh TK152'    },
};
const STATUS_CFG: Record<VoucherStatus, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Nháp',        color: 'text-slate-600',  bg: 'bg-slate-100'  },
  pending:  { label: 'Chờ duyệt',   color: 'text-amber-700',  bg: 'bg-amber-100'  },
  approved: { label: 'Đã duyệt',    color: 'text-emerald-700',bg: 'bg-emerald-100'},
  rejected: { label: 'Từ chối',     color: 'text-rose-700',   bg: 'bg-rose-100'   },
};
const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
const fmtMil = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;

// ── Seed data ────────────────────────────────────────────────────────────────
const SEED_MATERIALS: MaterialItem[] = [
  { id: 'm1', code: 'VT-001', name: 'Thép CB300-V', unit: 'Tấn',      tonKho: 50,  threshold: 60,  maxStock: 250, donGia: 15_000_000, nhaCungCap: 'Thép Hòa Phát',    viTri: 'Kho A-1', ngayNhapCuoi: '05/03/2026', ngayXuatCuoi: '07/03/2026' },
  { id: 'm2', code: 'VT-002', name: 'Xi măng PC40', unit: 'Tấn',      tonKho: 200, threshold: 100, maxStock: 500, donGia: 1_800_000,  nhaCungCap: 'Xi măng Hà Tiên',  viTri: 'Kho A-2', ngayNhapCuoi: '06/03/2026', ngayXuatCuoi: '07/03/2026' },
  { id: 'm3', code: 'VT-003', name: 'Cát vàng',     unit: 'm³',       tonKho: 150, threshold: 100, maxStock: 400, donGia: 350_000,    nhaCungCap: 'Cát Sông Đồng Nai',viTri: 'Bãi B-1', ngayNhapCuoi: '04/03/2026', ngayXuatCuoi: '06/03/2026' },
  { id: 'm4', code: 'VT-004', name: 'Gạch đặc 6x9', unit: '1000v',   tonKho: 80,  threshold: 50,  maxStock: 300, donGia: 1_200_000,  nhaCungCap: 'Gạch Đồng Tâm',    viTri: 'Bãi B-2', ngayNhapCuoi: '03/03/2026', ngayXuatCuoi: '05/03/2026' },
  { id: 'm5', code: 'VT-005', name: 'Đá 1×2',       unit: 'm³',       tonKho: 120, threshold: 80,  maxStock: 350, donGia: 450_000,    nhaCungCap: 'Đá Biên Hòa',      viTri: 'Bãi B-3', ngayNhapCuoi: '06/03/2026', ngayXuatCuoi: '07/03/2026' },
  { id: 'm6', code: 'VT-006', name: 'Sơn nước nội', unit: 'Thùng',   tonKho: 15,  threshold: 20,  maxStock: 100, donGia: 850_000,    nhaCungCap: 'Sơn 4 Mùa',        viTri: 'Kho C-1', ngayNhapCuoi: '01/03/2026', ngayXuatCuoi: '02/03/2026' },
  { id: 'm7', code: 'VT-007', name: 'Ống PVC Φ90',  unit: 'Cây',      tonKho: 200, threshold: 50,  maxStock: 300, donGia: 95_000,     nhaCungCap: 'Nhựa Bình Minh',   viTri: 'Kho C-2', ngayNhapCuoi: '28/02/2026', ngayXuatCuoi: '28/02/2026' },
];

const SEED_VOUCHERS: Voucher[] = [
  {
    id: 'v1', type: 'PN', code: 'PN-2026-001', ngay: '05/03/2026',
    nguoiLap: 'Hoàng Thị E', nguoiDuyet: 'Trần Văn B', status: 'approved',
    ghiChu: 'Nhập thép đợt 3 theo HĐ 2026/HP-001', nhaCungCap: 'Thép Hòa Phát',
    butToan: 'Nợ TK152 / Có TK331', totalAmount: 750_000_000,
    items: [{ matHang: 'Thép CB300-V', donVi: 'Tấn', soLuong: 50, donGia: 15_000_000, thanhTien: 750_000_000 }],
  },
  {
    id: 'v2', type: 'PX', code: 'PX-2026-012', ngay: '07/03/2026',
    nguoiLap: 'Hoàng Thị E', nguoiDuyet: '', status: 'pending',
    ghiChu: 'Xuất thép thi công dầm tầng 3 trục A-D', nhaCungCap: '',
    butToan: 'Nợ TK621 / Có TK152', totalAmount: 300_000_000,
    items: [{ matHang: 'Thép CB300-V', donVi: 'Tấn', soLuong: 20, donGia: 15_000_000, thanhTien: 300_000_000 }],
  },
  {
    id: 'v3', type: 'VAT', code: 'HĐ-0001234', ngay: '05/03/2026',
    nguoiLap: 'Hoàng Thị E', nguoiDuyet: '', status: 'pending',
    ghiChu: 'Hóa đơn VAT mua thép đợt 3', nhaCungCap: 'Thép Hòa Phát',
    hoaDonVAT: '0001234', butToan: 'Nợ TK133 / Có TK331', totalAmount: 75_000_000,
    items: [{ matHang: 'VAT 10% — Thép CB300-V', donVi: 'VNĐ', soLuong: 1, donGia: 75_000_000, thanhTien: 75_000_000 }],
  },
  {
    id: 'v4', type: 'PN', code: 'PN-2026-002', ngay: '06/03/2026',
    nguoiLap: 'Hoàng Thị E', nguoiDuyet: 'Trần Văn B', status: 'approved',
    ghiChu: 'Nhập xi măng đợt 5', nhaCungCap: 'Xi măng Hà Tiên',
    butToan: 'Nợ TK152 / Có TK331', totalAmount: 360_000_000,
    items: [{ matHang: 'Xi măng PC40', donVi: 'Tấn', soLuong: 200, donGia: 1_800_000, thanhTien: 360_000_000 }],
  },
  {
    id: 'v5', type: 'PX', code: 'PX-2026-013', ngay: '07/03/2026',
    nguoiLap: 'Hoàng Thị E', nguoiDuyet: '', status: 'draft',
    ghiChu: 'Xuất cát cho hạng mục trát tường tầng 2', nhaCungCap: '',
    butToan: 'Nợ TK621 / Có TK152', totalAmount: 17_500_000,
    items: [{ matHang: 'Cát vàng', donVi: 'm³', soLuong: 50, donGia: 350_000, thanhTien: 17_500_000 }],
  },
];

const SEED_KIEMKE: KiemKe[] = [
  {
    id: 'kk1', ngay: '01/03/2026', nguoiKiemKe: 'Hoàng Thị E', nguoiDuyet: 'Trần Văn B',
    status: 'approved', ghiChu: 'Kiểm kê đầu tháng 3/2026',
    items: [
      { matHangId: 'm1', tenMatHang: 'Thép CB300-V',   donVi: 'Tấn',   soSach: 52,  thucTe: 50,  chenhLech: -2,  ghiChu: 'Sai lệch nhỏ, đã điều chỉnh' },
      { matHangId: 'm2', tenMatHang: 'Xi măng PC40',   donVi: 'Tấn',   soSach: 200, thucTe: 200, chenhLech: 0,   ghiChu: '' },
      { matHangId: 'm3', tenMatHang: 'Cát vàng',       donVi: 'm³',    soSach: 152, thucTe: 150, chenhLech: -2,  ghiChu: 'Bay hao tự nhiên' },
      { matHangId: 'm6', tenMatHang: 'Sơn nước nội',   donVi: 'Thùng', soSach: 15,  thucTe: 15,  chenhLech: 0,   ghiChu: '' },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function MaterialsDashboard({ project, onAlert, currentRole = 'chi_huy_truong' }: Props) {
  const { ok: notifOk, err: notifErr, info: notifInfo } = useNotification();
  // Derive UserContext from legacy role
  const legacyRoleMap: Record<string, string> = {
    // Pass-through 24 roles
    giam_doc:'giam_doc', pm:'pm', ke_toan_truong:'ke_toan_truong',
    truong_qs:'truong_qs', truong_qaqc:'truong_qaqc', truong_hse:'truong_hse', hr_truong:'hr_truong',
    chi_huy_truong:'chi_huy_truong', chi_huy_pho:'chi_huy_pho',
    qs_site:'qs_site', qaqc_site:'qaqc_site', ks_giam_sat:'ks_giam_sat', hse_site:'hse_site',
    ke_toan_site:'ke_toan_site', ke_toan_kho:'ke_toan_kho', hr_site:'hr_site',
    thu_kho:'thu_kho', thu_ky_site:'thu_ky_site', operator:'operator',
    // Legacy aliases
    ke_toan:'ke_toan_site', giam_sat:'ks_giam_sat',
  };
  const matCtx = {
    userId: `user_${currentRole}`,
    roleId: (legacyRoleMap[currentRole] || currentRole || 'operator') as any,
  };
  const projectId = project?.id || 'default_project';

  // ── Permission: chỉ L2+ mới duyệt được (Thủ kho L1 không tự duyệt)
  const APPROVE_LEVEL_MAP: Record<string, number> = {
    giam_doc:5, pm:4, ke_toan_truong:4,
    chi_huy_truong:3, chi_huy_pho:3,
    ke_toan_site:2, ke_toan_kho:2, ks_giam_sat:2, qaqc_site:2, qs_site:2,
    thu_kho:1, thu_ky_site:1,
  };
  const matRoleId = legacyRoleMap[currentRole] || currentRole || 'operator';
  const matLevel  = APPROVE_LEVEL_MAP[matRoleId] ?? 1;
  const canApproveVoucher = matLevel >= 2; // L1 (thủ kho) KHÔNG được duyệt
  const pid = project?.id ?? 'p1';
  const projectName = project?.name ?? 'Dự án';

  // ── State — ALL hooks first ──────────────────────────────────────────────
  const [matTab, setMatTab] = useState<MatTab>(() => {
    const saved = sessionStorage.getItem('gem_action_subtab');
    const valid: MatTab[] = ['kho','chungtu','kiemsoat','dexuat'];
    if (saved && (valid as string[]).includes(saved)) { sessionStorage.removeItem('gem_action_subtab'); return saved as MatTab; }
    return 'kho';
  });
  const [materials, setMaterials]   = useState<MaterialItem[]>(SEED_MATERIALS);
  const [vouchers, setVouchers]     = useState<Voucher[]>(SEED_VOUCHERS);
  const [kiemKes, setKiemKes]       = useState<KiemKe[]>(SEED_KIEMKE);

  // MATERIAL_REQUEST state
  const [mrList, setMrList]         = useState<MaterialRequest[]>([]);
  const [showMRForm, setShowMRForm] = useState(false);
  const [mrForm2, setMrForm2] = useState({
    nguoiLap: '', chucVuNguoiLap: '', nguoiNhan: '',
    uuTien: 'normal' as 'normal'|'urgent'|'critical',
    nccGoiY: '',
  });
  const [mrHangMuc, setMrHangMuc]   = useState('');
  const [mrLyDo, setMrLyDo]         = useState('');
  const [mrCanNgay, setMrCanNgay]   = useState('');
  const [mrItems, setMrItems]       = useState<MRItem[]>([{ matHangId: '', tenMatHang: '', donVi: '', soLuong: 1, ghiChu: '' }]);
  const [selectedMR, setSelectedMR] = useState<MaterialRequest | null>(null);

  // Kho tab
  const [khoSearch, setKhoSearch]   = useState('');
  const [khoFilter, setKhoFilter]   = useState<'all' | 'low' | 'ok' | 'excess'>('all');
  const [showNhapNhanh, setShowNhapNhanh] = useState(false);
  const [showXuatNhanh, setShowXuatNhanh] = useState(false);
  // Extended form fields
  const [vForm, setVForm] = useState({
    nguoiLap: '', chucVuNguoiLap: '', nguoiNhan: '', nguoiGiao: '',
    kho: 'Kho chính', soHoaDon: '', nhaCungCap: '',
    mucDich: '', phuongTien: '', ghiChu: '',
    items: [{ matHangId:'', matHang:'', donVi:'', soLuong:1, donGia:0, thanhTien:0 }],
  });

  // gem:open-action — WorkspaceActionBar trigger
  useEffect(() => {
    const handler = (e: Event) => {
      const { actionId } = (e as CustomEvent).detail;
      if (actionId === 'WAREHOUSE_EXIT')   { setMatTab('chungtu'); setShowXuatNhanh(true); }
      if (actionId === 'WAREHOUSE_ENTRY')  { setMatTab('chungtu'); setShowNhapNhanh(true); }
      if (actionId === 'MATERIAL_REQUEST') { setMatTab('dexuat');  setShowMRForm(true); }
    };
    window.addEventListener('gem:open-action', handler);
    return () => window.removeEventListener('gem:open-action', handler);
  }, []);
  const [nhanhMat, setNhanhMat]     = useState('');
  const [nhanhSL, setNhanhSL]       = useState('');
  const [nhanhGhiChu, setNhanhGhiChu] = useState('');

  // Chứng từ tab
  const [ctFilter, setCtFilter]     = useState<'all' | VoucherType>('all');
  const [ctStatus, setCtStatus]     = useState<'all' | VoucherStatus>('all');
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [newVoucherType, setNewVoucherType]   = useState<VoucherType>('PN');

  // GEM scan
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [gemAnalysis, setGemAnalysis] = useState('');
  const [gemLoading, setGemLoading] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null); // S24: replace confirm()

  // Kiểm soát tab
  const [selectedKK, setSelectedKK] = useState<KiemKe | null>(null);
  const [showKKForm, setShowKKForm] = useState(false);
  const [printVoucher, setPrintVoucher] = useState<Voucher | null>(null);
  const [printInventory, setPrintInventory] = useState<KiemKe | null>(null);

  // ── Load from db + seed approvalEngine docs ────────────────────────────
  useEffect(() => {
    (async () => {
      const [m, v, k, mr] = await Promise.all([
        db.get('mat_items',    pid, SEED_MATERIALS),
        db.get('mat_vouchers', pid, SEED_VOUCHERS),
        db.get('mat_kiemke',   pid, SEED_KIEMKE),
        db.get('mat_requests', pid, []),
      ]);
      if ((m as any[]).length) setMaterials(m as any);
      if ((v as any[]).length) setVouchers(v as any);
      if ((k as any[]).length) setKiemKes(k as any);
      if ((mr as any[]).length) setMrList(mr as any);

      // ── Seed approvalEngine từ legacy vouchers (idempotent) ─────────────
      // Đảm bảo ApprovalQueue của L3 luôn có dữ liệu ngay từ đầu
      const docTypeMap: Record<string, any> = {
        PN: 'WAREHOUSE_ENTRY', PX: 'WAREHOUSE_EXIT',
        VAT: 'FINANCIAL_VOUCHER', KK: 'FINANCIAL_VOUCHER',
      };
      const loadedVouchers = (v as any[]).length ? v as any[] : SEED_VOUCHERS;
      const seedInputs: SeedVoucherInput[] = loadedVouchers.map((voucher: any) => ({
        voucherId:    voucher.id,
        voucherCode:  voucher.code,
        docType:      docTypeMap[voucher.type] || 'WAREHOUSE_EXIT',
        title:        `${voucher.type === 'PN' ? 'Phiếu Nhập Kho' : voucher.type === 'PX' ? 'Phiếu Xuất Kho' : voucher.type === 'VAT' ? 'Hóa đơn VAT' : 'Chứng từ'} — ${voucher.nhaCungCap || voucher.nguoiLap || voucher.code}`,
        amount:       voucher.totalAmount || voucher.items?.reduce((s: number, i: any) => s + (i.thanhTien || 0), 0) || 0,
        voucherData:  voucher,
        legacyStatus: voucher.status as 'approved' | 'pending' | 'draft',
      }));
      const currentProjectId = project?.id || pid;
      seedApprovalDocs(currentProjectId, seedInputs);
    })();
  }, [pid]);

  const save = useCallback((col: string, data: unknown[]) => db.set(col, pid, data), [pid]);
  const saveMR = useCallback((data: MaterialRequest[]) => db.set('mat_requests', pid, data), [pid]);

  // Realtime sync — tự refresh khi device khác cập nhật
  useRealtimeSync(pid, ['mat_items', 'mat_vouchers', 'mat_kiemke', 'mat_requests'], async () => {
    const [m, v, k, mr] = await Promise.all([
      db.get('mat_items',    pid, []),
      db.get('mat_vouchers', pid, []),
      db.get('mat_kiemke',   pid, []),
      db.get('mat_requests', pid, []),
    ]);
    if ((m as any[]).length) setMaterials(m as any);
    if ((v as any[]).length) setVouchers(v as any);
    if ((k as any[]).length) setKiemKes(k as any);
    if ((mr as any[]).length) setMrList(mr as any);
  });

  // ── MR computed ──────────────────────────────────────────────────────────
  const pendingMR  = mrList.filter(r => r.status === 'pending');
  const approvedMR = mrList.filter(r => r.status === 'approved');

  // Helper: kiểm tra vật tư đã có MR approved chưa (prerequisite WAREHOUSE_EXIT)
  const hasApprovedMR = (matHangId: string): boolean =>
    approvedMR.some(r => r.items.some(i => i.matHangId === matHangId));

  // ── Computed alerts — push ra ngoài ─────────────────────────────────────
  const alerts = useMemo<MatAlert[]>(() => {
    const result: MatAlert[] = [];
    materials.forEach(m => {
      if (m.tonKho < m.threshold) {
        result.push({ id: `low-${m.id}`, level: 'urgent', title: `Sắp hết — ${m.name}`, msg: `Tồn kho ${m.tonKho} ${m.unit} < ngưỡng ${m.threshold} ${m.unit}. Cần đặt hàng gấp.`, targetTab: 'kho', matHangId: m.id });
      }
      if (m.tonKho > m.maxStock) {
        result.push({ id: `excess-${m.id}`, level: 'warning', title: `Tồn kho vượt mức — ${m.name}`, msg: `Tồn ${m.tonKho} ${m.unit} vượt tối đa ${m.maxStock}. Nguy cơ ứ đọng vốn.`, targetTab: 'kho', matHangId: m.id });
      }
    });
    const pendingOld = vouchers.filter(v => v.status === 'pending');
    if (pendingOld.length > 0) {
      result.push({ id: 'pending-ct', level: 'warning', title: `${pendingOld.length} chứng từ chờ duyệt`, msg: 'Cần phê duyệt để ghi sổ kế toán đúng hạn.', targetTab: 'chungtu' });
    }
    const kkChenhLech = kiemKes.filter(k => k.items.some(i => i.chenhLech !== 0) && k.status === 'approved');
    if (kkChenhLech.length > 0) {
      result.push({ id: 'kk-cl', level: 'warning', title: 'Kiểm kê phát hiện chênh lệch', msg: 'Có sai lệch giữa sổ sách và thực tế. Cần bút toán điều chỉnh.', targetTab: 'kiemsoat' });
    }
    return result;
  }, [materials, vouchers, kiemKes]);

  useEffect(() => { onAlert?.(alerts); }, [alerts, onAlert]);

  // ── Computed stats ───────────────────────────────────────────────────────
  const totalValue   = materials.reduce((s, m) => s + m.tonKho * m.donGia, 0);
  const lowItems     = materials.filter(m => m.tonKho < m.threshold);
  const excessItems  = materials.filter(m => m.tonKho > m.maxStock);
  const pendingVouchers = vouchers.filter(v => v.status === 'pending');
  const pendingMRCount  = mrList.filter(r => r.status === 'pending').length;

  const filteredMaterials = useMemo(() => materials.filter(m => {
    const matchSearch = !khoSearch || m.name.toLowerCase().includes(khoSearch.toLowerCase()) || m.code.toLowerCase().includes(khoSearch.toLowerCase());
    const ratio = m.tonKho / m.threshold;
    const matchFilter = khoFilter === 'all' || (khoFilter === 'low' && m.tonKho < m.threshold) || (khoFilter === 'ok' && ratio >= 1 && m.tonKho <= m.maxStock) || (khoFilter === 'excess' && m.tonKho > m.maxStock);
    return matchSearch && matchFilter;
  }), [materials, khoSearch, khoFilter]);

  const filteredVouchers = useMemo(() => vouchers.filter(v =>
    (ctFilter === 'all' || v.type === ctFilter) &&
    (ctStatus === 'all' || v.status === ctStatus)
  ), [vouchers, ctFilter, ctStatus]);

  // ── Stock level helper ───────────────────────────────────────────────────
  const stockLevel = (m: MaterialItem) => {
    if (m.tonKho < m.threshold) return 'low';
    if (m.tonKho > m.maxStock) return 'excess';
    return 'ok';
  };
  const stockCfg = { low: { color: 'text-rose-600', bg: 'bg-rose-100', bar: 'bg-rose-500', label: 'Sắp hết' }, ok: { color: 'text-emerald-600', bg: 'bg-emerald-100', bar: 'bg-emerald-500', label: 'Đủ' }, excess: { color: 'text-blue-600', bg: 'bg-blue-100', bar: 'bg-blue-500', label: 'Thừa' } };

  // ── GEM scan chứng từ ────────────────────────────────────────────────────
  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setScanning(true); setScanResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const base64 = (ev.target?.result as string)?.split(',')[1];
        const mimeType = file.type || 'image/jpeg';
        const model = genAI.getGenerativeModel({ model: GEM_MODEL, generationConfig: { temperature: 0.1 } });
        const r = await (model as any).generateContent({
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: `Bóc tách chứng từ vật tư xây dựng. Xác định loại (PN=phiếu nhập kho, PX=phiếu xuất kho, VAT=hóa đơn VAT, KK=kiểm kê). Trả về JSON thuần: { type:"PN"|"PX"|"VAT"|"KK", code:string, ngay:string, nhaCungCap:string, items:[{matHang:string,donVi:string,soLuong:number,donGia:number,thanhTien:number}], totalAmount:number, ghiChu:string }. Chỉ JSON, không markdown.` }
          ]}]
        });
        const text = r.response.text().replace(/```json|```/g, '').trim();
        try { setScanResult(JSON.parse(text)); } catch { setScanResult({ error: 'Không đọc được', raw: text }); }
      } catch { setScanResult({ error: 'Lỗi kết nối GEM' }); }
      setScanning(false);
      if (e.target) e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const confirmScanResult = () => {
    if (!scanResult || scanResult.error) return;
    const newV: Voucher = {
      id: `v${Date.now()}`, type: scanResult.type || 'PN', kho: '', nguoiNhan: '', chucVuNguoiLap: '',
      code: scanResult.code || `${scanResult.type || 'PN'}-${Date.now()}`,
      ngay: scanResult.ngay || new Date().toLocaleDateString('vi-VN'),
      nguoiLap: 'GEM AI', nguoiDuyet: '', status: 'pending',
      ghiChu: scanResult.ghiChu || 'Tạo từ GEM scan',
      nhaCungCap: scanResult.nhaCungCap || '',
      butToan: VOUCHER_TYPE_CFG[scanResult.type as VoucherType]?.tk || '',
      totalAmount: scanResult.totalAmount || 0,
      items: scanResult.items || [],
    };
    const updated = [newV, ...vouchers];
    setVouchers(updated); save('mat_vouchers', updated);
    setScanResult(null); setMatTab('chungtu');
  };

  // ── GEM phân tích kho ────────────────────────────────────────────────────
  const runGemAnalysis = async () => {
    setGemLoading(true); setGemAnalysis('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL, generationConfig: { temperature: 0.25 }, systemInstruction: 'Bạn là Nàng GEM Siêu Việt — chuyên gia quản lý vật tư xây dựng. Xưng "em", gọi "Anh/Chị". Phân tích sắc bén, thực tế.' });
      const r = await model.generateContent(
        `Phân tích tình trạng kho vật tư dự án ${projectName}:\n\nTổng giá trị tồn kho: ${fmtMil(totalValue)}\nVật tư sắp hết (${lowItems.length}): ${lowItems.map(m => `${m.name} tồn ${m.tonKho}/${m.threshold} ${m.unit}`).join(', ')}\nVật tư tồn thừa (${excessItems.length}): ${excessItems.map(m => `${m.name} tồn ${m.tonKho}/${m.maxStock} ${m.unit}`).join(', ')}\nChứng từ chờ duyệt: ${pendingVouchers.length}\n\nHãy:\n1. Đánh giá rủi ro cung ứng vật tư\n2. Gợi ý vật tư cần đặt hàng ngay (ưu tiên theo tiến độ thi công)\n3. Phân tích vật tư tồn thừa — giải pháp xử lý\n4. Khuyến nghị tối ưu hóa quản lý kho tuần tới\nBằng tiếng Việt, súc tích.`
      );
      setGemAnalysis(r.response.text());
    } catch { setGemAnalysis('Dạ em chưa kết nối được GEM, Anh/Chị thử lại sau nhé.'); }
    setGemLoading(false);
  };

  // ── Thủ kho: Hủy phiếu (draft/pending chưa duyệt) ───────────────────────
  const cancelVoucher = (id: string) => {
    const v = vouchers.find(x => x.id === id);
    if (!v) return;
    if (v.status === 'approved') { notifErr('Không thể hủy phiếu đã được duyệt.'); return; }
    // Xóa doc khỏi approvalEngine nếu có
    try {
      const all = JSON.parse(localStorage.getItem(`gem_approvals_${projectId}`) || '[]');
      const filtered = all.filter((d: any) => d.data?.voucherId !== id);
      localStorage.setItem(`gem_approvals_${projectId}`, JSON.stringify(filtered));
    } catch {}
    const upd = vouchers.filter(x => x.id !== id);
    setVouchers(upd);
    save('mat_vouchers', upd);
    if (selectedVoucher?.id === id) setSelectedVoucher(null);
  };

  // ── Thủ kho: Lưu chỉnh sửa phiếu (chỉ khi còn draft/pending) ──────────
  const saveEditVoucher = () => {
    if (!editingVoucher) return;
    const newTotal = editItems.reduce((s, i) => s + i.thanhTien, 0);
    const updated: Voucher = {
      ...editingVoucher,
      items:       editItems,
      ghiChu:      editGhiChu,
      totalAmount: newTotal,
    };
    // Cập nhật doc trong approvalEngine nếu đã tạo
    try {
      const all = JSON.parse(localStorage.getItem(`gem_approvals_${projectId}`) || '[]');
      const idx = all.findIndex((d: any) => d.data?.voucherId === editingVoucher.id);
      if (idx >= 0) {
        all[idx].amount = newTotal;
        all[idx].data.voucher = updated;
        localStorage.setItem(`gem_approvals_${projectId}`, JSON.stringify(all));
      }
    } catch {}
    const upd = vouchers.map(x => x.id === editingVoucher.id ? updated : x);
    setVouchers(upd);
    save('mat_vouchers', upd);
    if (selectedVoucher?.id === editingVoucher.id) setSelectedVoucher(updated);
    setEditingVoucher(null);
  };

  // ── MATERIAL_REQUEST: Tạo mới ───────────────────────────────────────────
  const submitMR = () => {
    const validItems = mrItems.filter(i => i.tenMatHang && i.soLuong > 0);
    if (!mrHangMuc || validItems.length === 0) {
      notifInfo('Vui lòng nhập hạng mục thi công và ít nhất 1 vật tư cần xuất.'); return;
    }
    const estimate = validItems.reduce((s, i) => {
      const mat = materials.find(m => m.id === i.matHangId);
      return s + i.soLuong * (mat?.donGia || 0);
    }, 0);
    const newMR: MaterialRequest = {
      id: `mr${Date.now()}`, code: `DXVT-${Date.now().toString().slice(-6)}`,
      ngay: new Date().toLocaleDateString('vi-VN'),
      nguoiLap: ROLES[matCtx.roleId]?.label || currentRole,
      hangMuc: mrHangMuc, lyDo: mrLyDo,
      canNgay: mrCanNgay || new Date(Date.now() + 86400000).toLocaleDateString('vi-VN'),
      status: 'draft', items: validItems, totalEstimate: estimate,
    };
    // Tạo doc trong approvalEngine
    const created = createDocument({
      projectId, docType: 'MATERIAL_REQUEST', ctx: matCtx,
      title: `Đề xuất VT — ${mrHangMuc}`,
      amount: estimate,
      thresholds: { ...DEFAULT_THRESHOLDS, projectId } as any,
      data: { mrId: newMR.id, hangMuc: mrHangMuc, items: validItems },
    });
    if (created.ok) {
      newMR.docId = created.data.id;
      submitDocument(projectId, created.data.id, matCtx, `Đề xuất VT cho hạng mục ${mrHangMuc}`);
      newMR.status = 'pending';
    }
    const upd = [newMR, ...mrList]; setMrList(upd); saveMR(upd);
    setShowMRForm(false); setMrHangMuc(''); setMrLyDo(''); setMrCanNgay('');
    setMrItems([{ matHangId: '', tenMatHang: '', donVi: '', soLuong: 1, ghiChu: '' }]);
    notifOk('Đã tạo và nộp Đề xuất cấp vật tư. Chỉ huy phó sẽ xem xét.');
  };

  // ── MATERIAL_REQUEST: Duyệt (L3+) ───────────────────────────────────────
  const approveMR = (mrId: string, pin?: string) => {
    const mr = mrList.find(r => r.id === mrId); if (!mr || !mr.docId) return;
    // Lấy doc và step hiện tại
    try {
      const allDocs: ApprovalDoc[] = JSON.parse(localStorage.getItem(`gem_approvals_${projectId}`) || '[]');
      const doc = allDocs.find(d => d.id === mr.docId);
      if (!doc) return;
      const workflow = WORKFLOWS['MATERIAL_REQUEST'];
      const currStep = workflow?.steps.find(s => s.stepId === doc.currentStepId);
      if (!currStep) return;
      // Nếu là REVIEW step → không cần PIN, action='REVIEW'
      // Nếu là APPROVE/R_A step → cần PIN, action='APPROVE'
      const isReviewStep = currStep.actionType === 'review';
      const result = processApproval({
        projectId, docId: mr.docId,
        action: isReviewStep ? 'REVIEW' : 'APPROVE',
        ctx: matCtx, pin: isReviewStep ? undefined : pin,
        comment: `Duyệt đề xuất VT — ${mr.hangMuc}`,
      });
      if (!result.ok) { notifErr((result as any).error); return; }
      const isApproved = result.data.status === 'APPROVED' || result.data.status === 'COMPLETED';
      const upd = mrList.map(r => r.id === mrId ? { ...r, status: isApproved ? 'approved' as const : 'pending' as const } : r);
      setMrList(upd); saveMR(upd);
      if (selectedMR?.id === mrId) setSelectedMR({ ...selectedMR, status: isApproved ? 'approved' : 'pending' });
      if (!isApproved) notifOk(`✅ Đã xem xét. Đề xuất đang chờ cấp cao hơn phê duyệt tiếp.`);
    } catch (e) { notifErr(`Lỗi xử lý: ${e}`); }
  };

  // ── Submit / Approve voucher — wired to approvalEngine ─────────────────
  // LUỒNG ĐÚNG:
  //   L1 Thủ kho   → nút "Nộp duyệt" → createDocument + submitDocument → SUBMITTED
  //   L3+ CH Phó   → tab Hàng chờ duyệt → processApproval(APPROVE) với PIN
  //   Kết quả: doc hiện trong ApprovalQueue của người có thẩm quyền
  const [pinPrompt, setPinPrompt]   = useState<{ voucherId: string; pin: string } | null>(null);
  const [pinError2, setPinError2]   = useState('');
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [editItems, setEditItems]   = useState<VoucherItem[]>([]);
  const [editGhiChu, setEditGhiChu] = useState('');

  // Tìm doc đã tồn tại trong approvalEngine cho voucher này
  const findExistingDoc = (voucherId: string) => {
    try {
      const all = JSON.parse(localStorage.getItem(`gem_approvals_${projectId}`) || '[]');
      return all.find((d: any) => d.data?.voucherId === voucherId) || null;
    } catch { return null; }
  };

  const approveVoucher = (id: string) => {
    const v = vouchers.find(x => x.id === id);
    if (!v) return;

    const docTypeMap: Record<string, any> = {
      PN: 'WAREHOUSE_ENTRY', PX: 'WAREHOUSE_EXIT',
      VAT: 'FINANCIAL_VOUCHER', KK: 'FINANCIAL_VOUCHER',
    };
    const docType  = docTypeMap[v.type] || 'WAREHOUSE_EXIT';
    const amount   = v.totalAmount || v.items?.reduce((s: number, i: any) => s + (i.thanhTien || i.soLuong * i.donGia || 0), 0) || 0;
    const thresholds = { ...DEFAULT_THRESHOLDS, projectId } as any;

    // ── Thủ kho (L1): chỉ tạo + nộp, KHÔNG tự duyệt ────────────────────
    if (matLevel <= 1) {
      const existing = findExistingDoc(id);
      if (existing && existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
        notifOk(`Phiếu đã được nộp duyệt (${existing.status}). Vui lòng chờ người có thẩm quyền xử lý.`);
        return;
      }
      // Tạo context Thủ kho
      const thuKhoCtx = { userId: `user_thu_kho`, roleId: 'thu_kho' as any };
      let docId = existing?.id;
      if (!docId) {
        const typeLabel = v.type === 'PN' ? 'Phiếu Nhập Kho' : v.type === 'PX' ? 'Phiếu Xuất Kho' : 'Chứng từ';
        const created = createDocument({
          projectId, docType, ctx: thuKhoCtx,
          title: `${typeLabel} — ${v.nhaCungCap || v.nguoiLap || v.code}`,
          amount, thresholds,
          data: { voucherId: id, type: v.type, voucher: v },
        });
        if (!created.ok) { notifErr(`Lỗi tạo chứng từ: ${(created as any).error}`); return; }
        docId = created.data.id;
      }
      const submitted = submitDocument(projectId, docId, thuKhoCtx, 'Nộp duyệt từ tab Vật tư');
      if (!submitted.ok) { notifErr(`Lỗi nộp duyệt: ${(submitted as any).error}`); return; }
      // Đổi local status → 'pending' để hiện nhãn "Chờ duyệt"
      const upd = vouchers.map(x => x.id === id ? { ...x, status: 'pending' as VoucherStatus } : x);
      setVouchers(upd);
      save('mat_vouchers', upd);
      if (selectedVoucher?.id === id) setSelectedVoucher({ ...selectedVoucher, status: 'pending' });
      notifInfo('Đã nộp phiếu lên hàng chờ duyệt. Chỉ huy phó sẽ xem xét và phê duyệt.');
      return;
    }

    // ── L3+ CH Phó trở lên: duyệt trực tiếp qua PIN ─────────────────────
    setPinPrompt({ voucherId: id, pin: '' });
  };

  const _doApprove = (
    id: string, docType: any, amount: number, thresholds: any, pin?: string
  ) => {
    const v = vouchers.find(x => x.id === id);
    if (!v) return;

    let existing = findExistingDoc(id);
    const thuKhoCtx = { userId: 'user_thu_kho', roleId: 'thu_kho' as any };

    if (!existing) {
      const typeLabel = v.type === 'PN' ? 'Phiếu Nhập Kho' : v.type === 'PX' ? 'Phiếu Xuất Kho' : 'Chứng từ';
      const created = createDocument({
        projectId, docType, ctx: thuKhoCtx,
        title: `${typeLabel} — ${v.nhaCungCap || v.nguoiLap || v.code}`,
        amount, thresholds,
        data: { voucherId: id, type: v.type, voucher: v },
      });
      if (!created.ok) { notifErr(`Lỗi tạo chứng từ: ${(created as any).error}`); return; }
      const sub = submitDocument(projectId, created.data.id, thuKhoCtx);
      if (!sub.ok) { notifErr(`Lỗi nộp: ${(sub as any).error}`); return; }
      existing = sub.data;
    } else if (existing.status === 'DRAFT') {
      const sub = submitDocument(projectId, existing.id, thuKhoCtx);
      if (!sub.ok) { notifErr(`Lỗi nộp: ${(sub as any).error}`); return; }
      existing = sub.data;
    }

    // ── v2.0: Xác định step hiện tại → REVIEW không cần PIN ──────────────
    const workflow = WORKFLOWS[docType as keyof typeof WORKFLOWS];
    const currStep = workflow?.steps.find((s: any) => s.stepId === existing!.currentStepId);
    const isReviewStep = currStep?.actionType === 'review';

    // Chỉ verify PIN cho APPROVE / R_A step
    if (!isReviewStep && pin) {
      const pinResult = verifyPin(matCtx.userId, pin);
      if (!pinResult.success) {
        if (pinResult.locked) setPinError2(`Tài khoản bị khóa ${pinResult.lockMinutes} phút`);
        else setPinError2(`PIN không đúng — còn ${pinResult.remainingAttempts} lần thử`);
        return;
      }
    }

    const result = processApproval({
      projectId, docId: existing.id,
      action: isReviewStep ? 'REVIEW' : 'APPROVE',
      ctx: matCtx,
      pin: isReviewStep ? undefined : pin,
      comment: 'Phê duyệt từ tab Vật tư',
    });

    if (!result.ok) {
      setPinError2((result as any).error || 'Không thể duyệt');
      return;
    }

    const finalStatus = result.data.status;
    const isFullyApproved = finalStatus === 'APPROVED' || finalStatus === 'COMPLETED';
    const roleName = ROLES[matCtx.roleId]?.label || currentRole;
    const newLocalStatus: VoucherStatus = isFullyApproved ? 'approved' : 'pending';
    const upd = vouchers.map(x =>
      x.id === id ? { ...x, status: newLocalStatus, nguoiDuyet: isFullyApproved ? roleName : '' } : x
    );
    setVouchers(upd);
    save('mat_vouchers', upd);
    if (selectedVoucher?.id === id)
      setSelectedVoucher({ ...selectedVoucher, status: newLocalStatus, nguoiDuyet: isFullyApproved ? roleName : '' });

    setPinPrompt(null);
    setPinError2('');

    if (!isFullyApproved) {
      notifOk(`✅ Đã ${isReviewStep ? 'xem xét' : 'duyệt'} bước này. Phiếu đang chờ cấp cao hơn (${finalStatus}).`);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package size={20} className="text-emerald-600" /> Vật tư — {projectName}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý kho · Chứng từ TT133 · Kiểm soát ngân sách vật tư</p>
        </div>
        {/* Alert badges */}
        <div className="flex gap-2 flex-wrap">
          {lowItems.length > 0 && (
            <button onClick={() => { setMatTab('kho'); setKhoFilter('low'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-200 transition-colors animate-pulse">
              <ShieldAlert size={12} /> {lowItems.length} sắp hết
            </button>
          )}
          {pendingVouchers.length > 0 && (
            <button onClick={() => { setMatTab('chungtu'); setCtStatus('pending'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-200 transition-colors">
              <Clock size={12} /> {pendingVouchers.length} chờ duyệt
            </button>
          )}
        </div>
      </div>

      {/* ── Sub-tab bar ────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5">
        {([
          { id: 'kho',      label: 'Kho hàng',   icon: <Box size={13} />,         badge: lowItems.length > 0 ? lowItems.length : 0 },
          { id: 'dexuat',   label: 'Đề xuất VT', icon: <ClipboardCheck size={13} />, badge: pendingMRCount },
          { id: 'chungtu',  label: 'Chứng từ',   icon: <FileText size={13} />,    badge: pendingVouchers.length },
          { id: 'kiemsoat', label: 'Kiểm soát',  icon: <BarChart2 size={13} />,   badge: 0 },
        ] as { id: MatTab; label: string; icon: React.ReactNode; badge: number }[]).map(t => (
          <button key={t.id} onClick={() => setMatTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative ${
              matTab === t.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {t.icon}{t.label}
            {t.badge > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${matTab === t.id ? 'bg-white/30 text-white' : 'bg-rose-500 text-white'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — KHO HÀNG
      ══════════════════════════════════════════════════════════════════════ */}
      {matTab === 'kho' && (
        <div className="space-y-4">

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Giá trị tồn kho',  val: fmtMil(totalValue),         unit: 'VNĐ',    color: 'emerald', icon: <TrendingUp size={16} /> },
              { label: 'Tổng mặt hàng',    val: String(materials.length),   unit: 'SKU',    color: 'slate',   icon: <Box size={16} /> },
              { label: 'Cần đặt hàng',     val: String(lowItems.length),    unit: 'MH',     color: lowItems.length > 0 ? 'rose' : 'slate', icon: <TrendingDown size={16} /> },
              { label: 'Tồn thừa',         val: String(excessItems.length), unit: 'MH',     color: excessItems.length > 0 ? 'blue' : 'slate', icon: <AlertCircle size={16} /> },
            ].map(k => (
              <div key={k.label} className={`bg-white border rounded-2xl p-4 flex items-center gap-3 ${k.color === 'rose' ? 'border-rose-200 bg-rose-50/30' : k.color === 'blue' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'}`}>
                <div className={`p-2.5 rounded-xl shrink-0 ${k.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : k.color === 'rose' ? 'bg-rose-100 text-rose-600' : k.color === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                  {k.icon}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-none mb-0.5">{k.label}</p>
                  <p className="text-lg font-bold text-slate-800 leading-none">{k.val} <span className="text-xs font-normal text-slate-400">{k.unit}</span></p>
                </div>
              </div>
            ))}
          </div>

          {/* Cảnh báo urgent */}
          {lowItems.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 space-y-1.5">
              <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5"><ShieldAlert size={12} /> Cần đặt hàng gấp</p>
              {lowItems.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-rose-100">
                  <div>
                    <span className="text-xs font-bold text-slate-800">{m.name}</span>
                    <span className="text-[10px] text-rose-600 ml-2">Tồn: {m.tonKho} {m.unit} / Ngưỡng: {m.threshold} {m.unit}</span>
                  </div>
                  <button onClick={() => { setShowNhapNhanh(true); setNhanhMat(m.id); }}
                    className="text-[10px] font-bold px-2.5 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700">
                    + Nhập ngay
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search + Filter + Actions */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={khoSearch} onChange={e => setKhoSearch(e.target.value)} placeholder="Tìm vật tư, mã hàng..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            {(['all', 'low', 'ok', 'excess'] as const).map(f => (
              <button key={f} onClick={() => setKhoFilter(f)}
                className={`px-3 py-2 text-[10px] font-bold rounded-xl transition-colors ${khoFilter === f ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {f === 'all' ? 'Tất cả' : f === 'low' ? `⚠ Sắp hết (${lowItems.length})` : f === 'ok' ? 'Đủ hàng' : `Tồn thừa (${excessItems.length})`}
              </button>
            ))}
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setShowXuatNhanh(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">
                <Truck size={12} /> Xuất nhanh
              </button>
              <button onClick={() => setShowNhapNhanh(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
                <Plus size={12} /> Nhập nhanh
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700">{filteredMaterials.length} mặt hàng</p>
              <p className="text-[10px] text-slate-400">Đơn giá: Bình quân gia quyền liên hoàn (TT133)</p>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredMaterials.map(m => {
                const sl = stockLevel(m);
                const cfg = stockCfg[sl];
                const pct = Math.min(100, Math.round(m.tonKho / m.maxStock * 100));
                return (
                  <div key={m.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-slate-400">{m.code}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800">{m.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-[10px] text-slate-400">{m.nhaCungCap} · {m.viTri}</p>
                          <p className="text-[10px] text-slate-400">Nhập: {m.ngayNhapCuoi} · Xuất: {m.ngayXuatCuoi}</p>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">{m.tonKho}/{m.maxStock} {m.unit}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-800">{fmtMil(m.tonKho * m.donGia)}</p>
                        <p className="text-[10px] text-slate-400">{fmtVND(m.donGia)}/{m.unit}</p>
                        <div className="flex gap-1 mt-2 justify-end">
                          <button onClick={() => { setShowNhapNhanh(true); setNhanhMat(m.id); }}
                            className="px-2 py-1 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">+Nhập</button>
                          <button onClick={() => { setShowXuatNhanh(true); setNhanhMat(m.id); }}
                            className="px-2 py-1 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">+Xuất</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GEM phân tích kho */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Sparkles size={12} className="text-emerald-500" /> GEM Phân tích kho</p>
              <button onClick={runGemAnalysis} disabled={gemLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold disabled:opacity-50">
                {gemLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                {gemLoading ? 'Đang phân tích...' : 'Phân tích ngay'}
              </button>
            </div>
            {gemAnalysis ? (
              <div className="text-xs text-slate-700 leading-relaxed bg-emerald-50 rounded-xl p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">{gemAnalysis}</div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">GEM phân tích rủi ro cung ứng, vật tư cần đặt hàng và tối ưu tồn kho</p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB ĐỀ XUẤT VẬT TƯ — MATERIAL_REQUEST
      ══════════════════════════════════════════════════════════════════════ */}
      {matTab === 'dexuat' && (
        <div className="space-y-4">

          {/* Header + nút tạo mới */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ClipboardCheck size={14} className="text-emerald-600" /> Đề xuất cấp vật tư
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">KS / KT lập đề xuất → CH Phó xem xét & duyệt → Thủ kho xuất kho</p>
            </div>
            <button onClick={() => setShowMRForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
              <Plus size={12} /> Đề xuất mới
            </button>
          </div>

          {mrList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <ClipboardCheck size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-medium">Chưa có đề xuất cấp vật tư</p>
              <p className="text-xs text-slate-300 mt-1">KS thi công lập đề xuất → CH Phó duyệt → Thủ kho xuất kho</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-100">
                {mrList.map(mr => {
                  const stCfg = mr.status === 'approved'
                    ? { label:'Đã duyệt', color:'text-emerald-700', bg:'bg-emerald-100' }
                    : mr.status === 'pending'
                    ? { label:'Chờ duyệt', color:'text-amber-700', bg:'bg-amber-100' }
                    : mr.status === 'rejected'
                    ? { label:'Từ chối', color:'text-rose-700', bg:'bg-rose-100' }
                    : { label:'Nháp', color:'text-slate-600', bg:'bg-slate-100' };
                  const canAct = matLevel >= 3 && mr.status === 'pending';
                  return (
                    <div key={mr.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-slate-400">{mr.code}</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${stCfg.bg} ${stCfg.color}`}>
                              {stCfg.label}
                            </span>
                            {mr.status === 'approved' && (
                              <span className="text-[9px] text-emerald-600 flex items-center gap-0.5">
                                <CheckCircle2 size={9} /> Có thể xuất kho
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-800">{mr.hangMuc}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {mr.nguoiLap} · {mr.ngay} · Cần trước: {mr.canNgay}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {mr.items.slice(0,3).map((it, idx) => (
                              <span key={idx} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {it.tenMatHang || 'VT'} × {it.soLuong} {it.donVi}
                              </span>
                            ))}
                            {mr.items.length > 3 && <span className="text-[9px] text-slate-400">+{mr.items.length - 3} nữa</span>}
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          {mr.totalEstimate > 0 && (
                            <p className="text-xs font-bold text-slate-700">{fmtMil(mr.totalEstimate)}</p>
                          )}
                          {canAct && (
                            <button onClick={() => approveMR(mr.id)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold">
                              <CheckCircle2 size={10} /> Duyệt
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex gap-2">
            <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="text-[10px] text-blue-700 leading-relaxed">
              <strong>Quy trình cấp vật tư:</strong> KS / KT thi công lập Đề xuất →
              CH Phó xem xét & duyệt → Thủ kho căn cứ đề xuất approved để lập Phiếu xuất kho.
              Phiếu xuất không có đề xuất kèm theo sẽ bị gắn cờ cảnh báo.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — CHỨNG TỪ
      ══════════════════════════════════════════════════════════════════════ */}
      {matTab === 'chungtu' && (
        <div className="space-y-4">

          {/* GEM Scan section */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0">
                <ScanLine size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-900">GEM Scan chứng từ tự động</p>
                <p className="text-xs text-emerald-700">Chụp / tải lên hóa đơn, phiếu nhập/xuất — GEM nhận diện và tạo chứng từ</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Upload zone */}
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-white/60 hover:bg-white cursor-pointer transition-colors">
                <input ref={fileRef} type="file" onChange={handleScan} className="hidden" accept=".pdf,image/*" />
                {scanning ? (
                  <div className="flex flex-col items-center">
                    <Loader2 size={32} className="text-emerald-500 animate-spin mb-3" />
                    <p className="text-sm font-bold text-emerald-800">GEM đang đọc chứng từ...</p>
                    <p className="text-xs text-emerald-600 mt-1">AI Vision bóc tách số liệu</p>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="text-emerald-400 mb-2" />
                    <p className="text-sm font-semibold text-emerald-800">Kéo thả hoặc click tải lên</p>
                    <p className="text-xs text-emerald-600 mt-1">PDF · JPG · PNG</p>
                    <p className="text-[10px] text-emerald-500 mt-2">Hóa đơn VAT · Phiếu nhập · Phiếu xuất</p>
                  </>
                )}
              </div>

              {/* Scan result */}
              <div className="bg-white rounded-xl border border-emerald-100 p-4 min-h-[160px] flex flex-col">
                {scanResult ? (
                  scanResult.error ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <AlertCircle size={28} className="text-rose-400 mb-2" />
                      <p className="text-xs text-rose-600 font-semibold">{scanResult.error}</p>
                      {scanResult.raw && <p className="text-[10px] text-slate-400 mt-1 line-clamp-3">{scanResult.raw}</p>}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-xs font-bold text-emerald-700">Bóc tách thành công</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${VOUCHER_TYPE_CFG[scanResult.type as VoucherType]?.bg} ${VOUCHER_TYPE_CFG[scanResult.type as VoucherType]?.color}`}>
                          {VOUCHER_TYPE_CFG[scanResult.type as VoucherType]?.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs mb-3">
                        <span className="text-slate-500">Số chứng từ:</span><span className="font-semibold text-slate-800">{scanResult.code}</span>
                        <span className="text-slate-500">Ngày:</span><span className="font-semibold text-slate-800">{scanResult.ngay}</span>
                        <span className="text-slate-500">NCC:</span><span className="font-semibold text-slate-800 truncate">{scanResult.nhaCungCap || '—'}</span>
                        <span className="text-slate-500">Tổng tiền:</span><span className="font-bold text-emerald-700">{fmtMil(scanResult.totalAmount || 0)}</span>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 text-[10px] mb-3 flex-1 overflow-y-auto max-h-20">
                        {(scanResult.items || []).map((item: any, i: number) => (
                          <div key={i} className="flex justify-between py-0.5 border-b border-slate-100 last:border-0">
                            <span className="text-slate-700 font-medium truncate max-w-[60%]">{item.matHang}</span>
                            <span className="text-slate-500">{item.soLuong} {item.donVi}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={confirmScanResult}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1">
                          <CheckSquare size={11} /> Xác nhận & Tạo chứng từ
                        </button>
                        <button onClick={() => setScanResult(null)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl">
                          <X size={13} className="text-slate-500" />
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                    <Receipt size={36} className="text-emerald-300 mb-2" />
                    <p className="text-xs text-slate-600 font-medium">Kết quả bóc tách</p>
                    <p className="text-[10px] text-slate-400 mt-1 text-center">Tải chứng từ lên để GEM nhận diện tự động</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter + Actions */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
              {(['all', 'PN', 'PX', 'VAT', 'KK'] as const).map(f => (
                <button key={f} onClick={() => setCtFilter(f)}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${ctFilter === f ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {f === 'all' ? 'Tất cả' : VOUCHER_TYPE_CFG[f as VoucherType]?.label.replace('Phiếu ', '').replace('Hóa đơn ', '')}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
              {(['all', 'draft', 'pending', 'approved'] as const).map(s => (
                <button key={s} onClick={() => setCtStatus(s)}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${ctStatus === s ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {s === 'all' ? 'Tất cả' : STATUS_CFG[s as VoucherStatus]?.label}
                  {s === 'pending' && pendingVouchers.length > 0 && <span className="ml-1 bg-amber-500 text-white text-[8px] px-1 rounded-full">{pendingVouchers.length}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Voucher list */}
          <div className="space-y-2">
            {filteredVouchers.map(v => (
              <div key={v.id} onClick={() => setSelectedVoucher(v)}
                className={`bg-white border rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer ${v.status === 'pending' ? 'border-amber-200' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${VOUCHER_TYPE_CFG[v.type].bg}`}>
                    <FileText size={14} className={VOUCHER_TYPE_CFG[v.type].color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-700">{v.code}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${VOUCHER_TYPE_CFG[v.type].bg} ${VOUCHER_TYPE_CFG[v.type].color}`}>{VOUCHER_TYPE_CFG[v.type].label}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_CFG[v.status].bg} ${STATUS_CFG[v.status].color}`}>{STATUS_CFG[v.status].label}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{v.ghiChu}</p>
                    <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                      <span>{v.ngay}</span>
                      <span>· {v.nguoiLap}</span>
                      {v.nhaCungCap && <span>· {v.nhaCungCap}</span>}
                      <span className="text-[10px] text-slate-500 italic ml-1">{v.butToan}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-800">{fmtMil(v.totalAmount)}</p>
                    {v.status === 'draft' && matLevel <= 1 && (
                      <button onClick={e => { e.stopPropagation(); approveVoucher(v.id); }}
                        className="mt-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg">
                        ↑ Nộp duyệt
                      </button>
                    )}
                    {v.status === 'pending' && matLevel >= 3 && (
                      <button onClick={e => { e.stopPropagation(); approveVoucher(v.id); }}
                        className="mt-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg">
                        ✓ Duyệt
                      </button>
                    )}
                    {v.status === 'pending' && matLevel < 3 && (
                      <span className="mt-1.5 px-2 py-1 bg-amber-50 text-amber-600 text-[10px] rounded-lg block text-center">
                        ⏳ Chờ duyệt
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredVouchers.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">Không có chứng từ phù hợp</div>
            )}
          </div>

          {/* Voucher detail modal */}
          {selectedVoucher && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setSelectedVoucher(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start rounded-t-2xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-700">{selectedVoucher.code}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${VOUCHER_TYPE_CFG[selectedVoucher.type].bg} ${VOUCHER_TYPE_CFG[selectedVoucher.type].color}`}>{VOUCHER_TYPE_CFG[selectedVoucher.type].label}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{selectedVoucher.ngay} · {selectedVoucher.nguoiLap}</p>
                  </div>
                  <button onClick={() => setSelectedVoucher(null)}><X size={16} className="text-slate-400" /></button>
                </div>
                <div className="p-6 space-y-4">
                  {/* Items table */}
                  <div className="bg-slate-50 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2">Vật tư</th>
                          <th className="text-right px-3 py-2">SL</th>
                          <th className="text-right px-3 py-2">Đơn giá</th>
                          <th className="text-right px-3 py-2">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedVoucher.items.map((item, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2 font-medium text-slate-800">{item.matHang}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{item.soLuong} {item.donVi}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{fmtVND(item.donGia)}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtMil(item.thanhTien)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs text-slate-500">Tổng cộng:</span>
                    <span className="text-base font-black text-emerald-700">{fmtMil(selectedVoucher.totalAmount)}</span>
                  </div>
                  {/* Bút toán */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-1">Bút toán kế toán (TT133)</p>
                    <p className="text-xs font-mono text-indigo-800">{selectedVoucher.butToan}</p>
                    <p className="text-[10px] text-indigo-500 mt-1">→ Tự động đẩy sang tab Kế toán sau khi duyệt</p>
                  </div>
                  {selectedVoucher.ghiChu && (
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-500 mb-1">Ghi chú</p>
                      <p className="text-xs text-slate-700">{selectedVoucher.ghiChu}</p>
                    </div>
                  )}
                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                    {/* Thủ kho: Sửa + Hủy khi còn draft/pending (chưa duyệt) */}
                    {(selectedVoucher.status === 'draft' || selectedVoucher.status === 'pending') && matLevel <= 1 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingVoucher(selectedVoucher);
                            setEditItems([...selectedVoucher.items]);
                            setEditGhiChu(selectedVoucher.ghiChu);
                          }}
                          className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                          <Pencil size={13} /> Chỉnh sửa phiếu
                        </button>
                        <button
                          onClick={() => {
                            setCancelConfirmId(selectedVoucher.id);
                          }}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                          <Trash2 size={13} /> Hủy phiếu
                        </button>
                      </div>
                    )}
                    {/* Thủ kho: Nộp duyệt khi còn draft */}
                    {selectedVoucher.status === 'draft' && matLevel <= 1 && (
                      <button onClick={() => approveVoucher(selectedVoucher.id)}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={13} /> Nộp lên hàng chờ duyệt
                      </button>
                    )}
                    {/* L3+: Duyệt */}
                    {selectedVoucher.status === 'pending' && matLevel >= 3 && (
                      <button onClick={() => approveVoucher(selectedVoucher.id)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={13} /> Phê duyệt & Ghi sổ
                      </button>
                    )}
                    {selectedVoucher.status === 'pending' && matLevel < 3 && matLevel > 1 && (
                      <div className="flex-1 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl flex items-center justify-center gap-1.5">
                        <Clock size={13}/> Đang chờ CH Phó phê duyệt
                      </div>
                    )}
                    <button onClick={() => selectedVoucher && setPrintVoucher(selectedVoucher)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl">
                      <Printer size={13} /> In
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3 — KIỂM SOÁT
      ══════════════════════════════════════════════════════════════════════ */}
      {matTab === 'kiemsoat' && (
        <div className="space-y-4">

          {/* KPI tổng quan quản lý */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Tổng giá trị tồn',  val: fmtMil(totalValue),                                               unit: 'VNĐ',  color: 'emerald' },
              { label: 'Chứng từ đã duyệt', val: String(vouchers.filter(v => v.status === 'approved').length),      unit: 'CT',   color: 'slate'   },
              { label: 'Chờ phê duyệt',     val: String(pendingVouchers.length),                                    unit: 'CT',   color: pendingVouchers.length > 0 ? 'amber' : 'slate' },
              { label: 'Kiểm kê gần nhất',  val: kiemKes[0]?.ngay || '—',                                          unit: '',     color: 'slate'   },
            ].map(k => (
              <div key={k.label} className={`bg-white border rounded-2xl p-4 ${k.color === 'amber' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
                <p className="text-[10px] text-slate-400 font-semibold mb-1">{k.label}</p>
                <p className={`text-lg font-bold ${k.color === 'emerald' ? 'text-emerald-700' : k.color === 'amber' ? 'text-amber-700' : 'text-slate-800'}`}>
                  {k.val} <span className="text-xs font-normal text-slate-400">{k.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Ngân sách vật tư vs Thực tế */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><BarChart2 size={15} className="text-emerald-500" /> Ngân sách vật tư — Thực tế vs Kế hoạch</p>
            <div className="space-y-3">
              {materials.map(m => {
                const thucTe = m.tonKho * m.donGia;
                const kHoach = m.maxStock * m.donGia;
                const pct = Math.min(100, Math.round(thucTe / kHoach * 100));
                const overBudget = thucTe > kHoach * 0.9;
                return (
                  <div key={m.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-700 font-medium">{m.name}</span>
                      <span className={`font-bold ${overBudget ? 'text-amber-600' : 'text-slate-500'}`}>{fmtMil(thucTe)} / {fmtMil(kHoach)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit trail */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Eye size={12} className="text-slate-500" /> Audit Trail — Lịch sử giao dịch kho</p>
              <button onClick={() => setPrintInventory({ id: `S10-${new Date().toLocaleDateString("vi-VN").replace(/\//g,"")}`, ngay: new Date().toLocaleDateString("vi-VN"), status: "approved", nguoiKiemKe: "", nguoiDuyet: "", ghiChu: "", items: [] })} className="text-[10px] text-slate-500 hover:text-emerald-600 flex items-center gap-1"><Printer size={10} /> Xuất S10-DN</button>
            </div>
            <div className="divide-y divide-slate-100">
              {[...vouchers].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 10).map(v => (
                <div key={v.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${VOUCHER_TYPE_CFG[v.type].bg}`}>
                    <FileText size={12} className={VOUCHER_TYPE_CFG[v.type].color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">{v.code}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${STATUS_CFG[v.status].bg} ${STATUS_CFG[v.status].color}`}>{STATUS_CFG[v.status].label}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{v.nguoiLap} · {v.ngay} · <span className="font-mono italic">{v.butToan}</span></p>
                  </div>
                  <span className="text-xs font-bold text-slate-700 shrink-0">{fmtMil(v.totalAmount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kiểm kê định kỳ */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ClipboardCheck size={12} className="text-amber-500" /> Kiểm kê kho định kỳ</p>
              <button onClick={() => setShowKKForm(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-xl">
                <Plus size={10} /> Lập biên bản
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {kiemKes.map(kk => {
                const hasChenhLech = kk.items.some(i => i.chenhLech !== 0);
                return (
                  <div key={kk.id} onClick={() => setSelectedKK(kk)} className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{kk.ghiChu}</p>
                        <p className="text-[10px] text-slate-400">{kk.ngay} · KK: {kk.nguoiKiemKe} · Duyệt: {kk.nguoiDuyet || 'Chờ duyệt'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasChenhLech && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⚠ Chênh lệch</span>}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_CFG[kk.status].bg} ${STATUS_CFG[kk.status].color}`}>{STATUS_CFG[kk.status].label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kiểm kê detail modal */}
          {selectedKK && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setSelectedKK(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start rounded-t-2xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{selectedKK.ghiChu}</p>
                    <p className="text-xs text-slate-500">{selectedKK.ngay} · {selectedKK.nguoiKiemKe}</p>
                  </div>
                  <button onClick={() => setSelectedKK(null)}><X size={16} className="text-slate-400" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] text-slate-500 bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2">Vật tư</th>
                          <th className="text-right px-3 py-2">Sổ sách</th>
                          <th className="text-right px-3 py-2">Thực tế</th>
                          <th className="text-right px-3 py-2">Chênh lệch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedKK.items.map((item, i) => (
                          <tr key={i} className={`border-b border-slate-100 last:border-0 ${item.chenhLech !== 0 ? 'bg-amber-50' : ''}`}>
                            <td className="px-3 py-2 font-medium text-slate-800">{item.tenMatHang} <span className="text-slate-400">({item.donVi})</span></td>
                            <td className="px-3 py-2 text-right text-slate-600">{item.soSach}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{item.thucTe}</td>
                            <td className={`px-3 py-2 text-right font-bold ${item.chenhLech < 0 ? 'text-rose-600' : item.chenhLech > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                              {item.chenhLech > 0 ? '+' : ''}{item.chenhLech}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedKK.items.some(i => i.chenhLech !== 0) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-amber-700 mb-1">Bút toán điều chỉnh (TT133)</p>
                      <p className="text-xs font-mono text-amber-800">Nợ/Có TK152 — Điều chỉnh chênh lệch kiểm kê</p>
                      <p className="text-[10px] text-amber-600 mt-1">→ Chờ kế toán xác nhận và ghi sổ</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {selectedKK.status === 'pending' && (
                      <button onClick={() => {
                        const updated = kiemKes.map(k => k.id === selectedKK.id ? { ...k, status: 'approved' as VoucherStatus } : k);
                        setKiemKes(updated); save('mat_kiemke', updated);
                        setSelectedKK({ ...selectedKK, status: 'approved' });
                      }} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl">
                        ✓ Phê duyệt biên bản
                      </button>
                    )}
                    <button onClick={() => selectedKK && setPrintInventory(selectedKK)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl">
                      <Printer size={13} /> In biên bản
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── Edit Voucher Modal — Thủ kho chỉnh sửa phiếu ── */}
      {editingVoucher && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-slate-800 px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Pencil size={16} className="text-slate-300"/>
                <div>
                  <p className="text-white font-bold text-sm">Chỉnh sửa phiếu</p>
                  <p className="text-slate-400 text-[10px]">{editingVoucher.code} — {editingVoucher.type}</p>
                </div>
              </div>
              <button onClick={() => setEditingVoucher(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white">
                <X size={14}/>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Ghi chú */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ghi chú / Diễn giải</label>
                <textarea value={editGhiChu} onChange={e => setEditGhiChu(e.target.value)} rows={2}
                  className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"/>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hàng hóa</label>
                  <button
                    onClick={() => setEditItems(prev => [...prev, { matHang: '', donVi: '', soLuong: 1, donGia: 0, thanhTien: 0 }])}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg">
                    <Plus size={10}/> Thêm dòng
                  </button>
                </div>
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 rounded-xl p-2">
                      <input value={item.matHang} placeholder="Tên vật tư"
                        onChange={e => {
                          const upd = [...editItems];
                          upd[idx] = { ...upd[idx], matHang: e.target.value };
                          setEditItems(upd);
                        }}
                        className="col-span-4 text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                      <input value={item.donVi} placeholder="ĐVT"
                        onChange={e => {
                          const upd = [...editItems];
                          upd[idx] = { ...upd[idx], donVi: e.target.value };
                          setEditItems(upd);
                        }}
                        className="col-span-2 text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                      <input type="number" value={item.soLuong} placeholder="SL"
                        onChange={e => {
                          const sl = Number(e.target.value);
                          const upd = [...editItems];
                          upd[idx] = { ...upd[idx], soLuong: sl, thanhTien: sl * upd[idx].donGia };
                          setEditItems(upd);
                        }}
                        className="col-span-2 text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                      <input type="number" value={item.donGia} placeholder="Đơn giá"
                        onChange={e => {
                          const dg = Number(e.target.value);
                          const upd = [...editItems];
                          upd[idx] = { ...upd[idx], donGia: dg, thanhTien: upd[idx].soLuong * dg };
                          setEditItems(upd);
                        }}
                        className="col-span-3 text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                      <button onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 flex items-center justify-center h-7 w-7 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-500">
                        <Trash2 size={11}/>
                      </button>
                      {/* Thành tiền preview */}
                      <div className="col-span-11 text-right text-[9px] text-slate-500 pr-1">
                        = {(item.thanhTien || item.soLuong * item.donGia).toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tổng */}
              <div className="flex justify-between items-center bg-emerald-50 rounded-xl px-4 py-3">
                <span className="text-xs font-bold text-emerald-800">Tổng giá trị:</span>
                <span className="text-base font-black text-emerald-700">
                  {editItems.reduce((s, i) => s + (i.thanhTien || i.soLuong * i.donGia), 0).toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0">
              <button onClick={() => setEditingVoucher(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl">
                Bỏ qua
              </button>
              <button onClick={saveEditVoucher}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                <Save size={13}/> Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

            {/* ── PIN Modal — approve voucher ── */}
      {pinPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 overflow-hidden">
            <div className="bg-slate-900 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={18} className="text-amber-400"/>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Xác nhận phê duyệt</p>
                  <p className="text-slate-400 text-xs mt-0.5">Nhập PIN để ghi nhật ký kiểm toán</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <input
                type="password" maxLength={6} autoFocus
                value={pinPrompt.pin}
                onChange={e => { setPinPrompt({ ...pinPrompt, pin: e.target.value }); setPinError2(''); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = vouchers.find(x => x.id === pinPrompt.voucherId);
                    const docTypeMap: Record<string,any> = { PN:'WAREHOUSE_ENTRY', PX:'WAREHOUSE_EXIT', VAT:'FINANCIAL_VOUCHER', KK:'FINANCIAL_VOUCHER' };
                    _doApprove(pinPrompt.voucherId, ({'PN':'WAREHOUSE_ENTRY','PX':'WAREHOUSE_EXIT','VAT':'FINANCIAL_VOUCHER','KK':'FINANCIAL_VOUCHER'} as any)[v?.type||'PX'] || 'WAREHOUSE_EXIT', v?.totalAmount || v?.items?.reduce((s:number,i:any)=>s+(i.thanhTien||0),0) || 0, {...DEFAULT_THRESHOLDS, projectId} as any, pinPrompt.pin);
                  }
                }}
                placeholder="Nhập mã PIN..."
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-center text-lg tracking-[0.4em] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              {pinError2 && (
                <p className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {pinError2}
                </p>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setPinPrompt(null); setPinError2(''); }}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50">
                  Hủy
                </button>
                <button
                  onClick={() => {
                    const v = vouchers.find(x => x.id === pinPrompt.voucherId);
                    const docTypeMap: Record<string,any> = { PN:'WAREHOUSE_ENTRY', PX:'WAREHOUSE_EXIT', VAT:'FINANCIAL_VOUCHER', KK:'FINANCIAL_VOUCHER' };
                    _doApprove(pinPrompt.voucherId, ({'PN':'WAREHOUSE_ENTRY','PX':'WAREHOUSE_EXIT','VAT':'FINANCIAL_VOUCHER','KK':'FINANCIAL_VOUCHER'} as any)[v?.type||'PX'] || 'WAREHOUSE_EXIT', v?.totalAmount || v?.items?.reduce((s:number,i:any)=>s+(i.thanhTien||0),0) || 0, {...DEFAULT_THRESHOLDS, projectId} as any, pinPrompt.pin);
                  }}
                  disabled={pinPrompt.pin.length < 4}
                  className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print components */}

      {/* ── MODALS — DESIGN_SYSTEM: always at end of component ── */}

      {/* Nhập nhanh form */}
      {/* Modal Phiếu Nhập Kho */}
      <ModalForm
        open={showNhapNhanh}
        onClose={() => setShowNhapNhanh(false)}
        title="Phiếu Nhập Kho"
        subtitle="Tạo phiếu nhập — chờ duyệt"
        icon={<Package size={18}/>}
        color="emerald"
        width="lg"
        footer={<>

          <FormSection title="Ho so dinh kem">
            <FormFileUpload files={[]} onChange={()=>{}} accept=".pdf,.jpg,.png,.xlsx" maxFiles={3} label="Phieu nhap kho / Chung tu"/>
          </FormSection>
                    <BtnCancel onClick={() => setShowNhapNhanh(false)} />
          <BtnSubmit label="Tạo Phiếu Nhập" onClick={() => {
            if (!nhanhMat || !nhanhSL) return;
            const mat = materials.find(m => m.id === nhanhMat); if (!mat) return;
            const sl = Number(nhanhSL);
            const newV: Voucher = {
              id: `v${Date.now()}`, type: 'PN', code: `PN-${Date.now()}`,
              ngay: vForm.kho ? new Date().toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
              nguoiLap: vForm.nguoiLap || 'Thủ kho',
              chucVuNguoiLap: vForm.chucVuNguoiLap || 'Thủ kho',
              nguoiNhan: vForm.nguoiNhan || '',
              nguoiGiao: vForm.nguoiGiao || '',
              nguoiDuyet: '', status: 'pending',
              kho: vForm.kho || 'Kho chính',
              soHoaDon: vForm.soHoaDon,
              nhaCungCap: vForm.nhaCungCap || nhanhGhiChu,
              ghiChu: vForm.ghiChu || `Nhập ${mat.name}`,
              butToan: 'Nợ TK152 / Có TK331',
              totalAmount: sl * mat.donGia,
              items: [{ matHang: mat.name, donVi: mat.unit, soLuong: sl, donGia: mat.donGia, thanhTien: sl * mat.donGia }],
            };
            const updV = [newV, ...vouchers]; setVouchers(updV); save('mat_vouchers', updV);
            setShowNhapNhanh(false); setNhanhMat(''); setNhanhSL(''); setNhanhGhiChu('');
            setVForm(v => ({...v, nguoiLap:'', nguoiNhan:'', nguoiGiao:'', soHoaDon:'', nhaCungCap:'', ghiChu:''}));
            setMatTab('chungtu'); notifOk('Đã tạo Phiếu Nhập Kho!');
          }} />
        </>}
      >
        <FormSection title="Thông tin phiếu">
          <FormGrid cols={2}>
            <FormRow label="Người lập phiếu" required>
              <input className={inputCls} value={vForm.nguoiLap} onChange={e => setVForm(v=>({...v,nguoiLap:e.target.value}))} placeholder="Họ tên người lập" />
            </FormRow>
            <FormRow label="Chức vụ">
              <input className={inputCls} value={vForm.chucVuNguoiLap} onChange={e => setVForm(v=>({...v,chucVuNguoiLap:e.target.value}))} placeholder="VD: Thủ kho, KS Vật tư" />
            </FormRow>
            <FormRow label="Người nhận hàng" required>
              <input className={inputCls} value={vForm.nguoiNhan} onChange={e => setVForm(v=>({...v,nguoiNhan:e.target.value}))} placeholder="Người trực tiếp nhận hàng" />
            </FormRow>
            <FormRow label="Người giao hàng (NCC)">
              <input className={inputCls} value={vForm.nguoiGiao} onChange={e => setVForm(v=>({...v,nguoiGiao:e.target.value}))} placeholder="Tên người giao từ nhà cung cấp" />
            </FormRow>
            <FormRow label="Kho nhập">
              <select className={selectCls} value={vForm.kho} onChange={e => setVForm(v=>({...v,kho:e.target.value}))}>
                <option>Kho chính</option><option>Kho phụ A</option><option>Kho phụ B</option><option>Kho vật tư tầng hầm</option>
              </select>
            </FormRow>
            <FormRow label="Số hóa đơn / chứng từ">
              <input className={inputCls} value={vForm.soHoaDon} onChange={e => setVForm(v=>({...v,soHoaDon:e.target.value}))} placeholder="VD: HD-2026-0312" />
            </FormRow>
            <FormRow label="Nhà cung cấp">
              <input className={inputCls} value={vForm.nhaCungCap} onChange={e => setVForm(v=>({...v,nhaCungCap:e.target.value}))} placeholder="Tên công ty / cá nhân NCC" />
            </FormRow>
            <FormRow label="Ghi chú">
              <input className={inputCls} value={vForm.ghiChu} onChange={e => setVForm(v=>({...v,ghiChu:e.target.value}))} placeholder="Ghi chú thêm nếu có" />
            </FormRow>
          </FormGrid>
        </FormSection>
        <FormSection title="Vật tư nhập kho">
          <FormGrid cols={2}>
            <FormRow label="Vật tư" required>
              <select className={selectCls} value={nhanhMat} onChange={e => setNhanhMat(e.target.value)}>
                <option value="">-- Chọn vật tư --</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name} ({m.unit})</option>)}
              </select>
            </FormRow>
            <FormRow label="Số lượng" required>
              <input type="number" className={inputCls} value={nhanhSL} onChange={e => setNhanhSL(e.target.value)} placeholder="Nhập số lượng" min={1} />
            </FormRow>
          </FormGrid>
        </FormSection>
      </ModalForm>

      {/* Modal Phiếu Xuất Kho */}
      <ModalForm
        open={showXuatNhanh}
        onClose={() => setShowXuatNhanh(false)}
        title="Phiếu Xuất Kho"
        subtitle="Tạo phiếu xuất — chờ duyệt"
        icon={<Truck size={18}/>}
        color="blue"
        width="lg"
        footer={<>
          <BtnCancel onClick={() => setShowXuatNhanh(false)} />
          <BtnSubmit label="Tạo Phiếu Xuất" color="blue" onClick={() => {
            if (!nhanhMat || !nhanhSL) return;
            const mat = materials.find(m => m.id === nhanhMat); if (!mat) return;
            const sl = Number(nhanhSL);
            if (sl > mat.tonKho) { notifErr(`Không đủ hàng! Tồn: ${mat.tonKho} ${mat.unit}`); return; }
            const newV: Voucher = {
              id: `v${Date.now()}`, type: 'PX', code: `PX-${Date.now()}`,
              ngay: new Date().toLocaleDateString('vi-VN'),
              nguoiLap: vForm.nguoiLap || 'Thủ kho',
              chucVuNguoiLap: vForm.chucVuNguoiLap || 'Thủ kho',
              nguoiNhan: vForm.nguoiNhan || '',
              nguoiDuyet: '', status: 'pending',
              kho: vForm.kho || 'Kho chính',
              mucDich: vForm.mucDich || nhanhGhiChu,
              phuongTien: vForm.phuongTien,
              ghiChu: vForm.ghiChu || nhanhGhiChu,
              butToan: 'Nợ TK621 / Có TK152',
              totalAmount: sl * mat.donGia,
              items: [{ matHang: mat.name, donVi: mat.unit, soLuong: sl, donGia: mat.donGia, thanhTien: sl * mat.donGia }],
            };
            const updV = [newV, ...vouchers]; setVouchers(updV); save('mat_vouchers', updV);
            setShowXuatNhanh(false); setNhanhMat(''); setNhanhSL(''); setNhanhGhiChu('');
            setVForm(v => ({...v, nguoiLap:'', nguoiNhan:'', mucDich:'', phuongTien:'', ghiChu:''}));
            setMatTab('chungtu'); notifOk('Đã tạo Phiếu Xuất Kho!');
          }} />
        </>}
      >
        <FormSection title="Thông tin phiếu">
          <FormGrid cols={2}>
            <FormRow label="Người đề xuất / lập phiếu" required>
              <input className={inputCls} value={vForm.nguoiLap} onChange={e => setVForm(v=>({...v,nguoiLap:e.target.value}))} placeholder="Họ tên người lập" />
            </FormRow>
            <FormRow label="Chức vụ">
              <input className={inputCls} value={vForm.chucVuNguoiLap} onChange={e => setVForm(v=>({...v,chucVuNguoiLap:e.target.value}))} placeholder="VD: KS Thi công, CH Phó" />
            </FormRow>
            <FormRow label="Người nhận trực tiếp" required>
              <input className={inputCls} value={vForm.nguoiNhan} onChange={e => setVForm(v=>({...v,nguoiNhan:e.target.value}))} placeholder="Người nhận để thi công" />
            </FormRow>
            <FormRow label="Kho xuất">
              <select className={selectCls} value={vForm.kho} onChange={e => setVForm(v=>({...v,kho:e.target.value}))}>
                <option>Kho chính</option><option>Kho phụ A</option><option>Kho phụ B</option><option>Kho vật tư tầng hầm</option>
              </select>
            </FormRow>
            <FormRow label="Mục đích xuất / hạng mục thi công" required>
              <input className={inputCls} value={vForm.mucDich} onChange={e => setVForm(v=>({...v,mucDich:e.target.value}))} placeholder="VD: Đổ BT sàn tầng 3 block A" />
            </FormRow>
            <FormRow label="Phương tiện vận chuyển">
              <input className={inputCls} value={vForm.phuongTien} onChange={e => setVForm(v=>({...v,phuongTien:e.target.value}))} placeholder="VD: Xe cẩu, xe tải biển số..." />
            </FormRow>
            <FormRow label="Ghi chú" >
              <input className={inputCls} value={vForm.ghiChu} onChange={e => setVForm(v=>({...v,ghiChu:e.target.value}))} placeholder="Ghi chú thêm nếu có" />
            </FormRow>
          </FormGrid>
        </FormSection>
        <FormSection title="Vật tư xuất kho">
          <FormGrid cols={2}>
            <FormRow label="Vật tư" required>
              <select className={selectCls} value={nhanhMat} onChange={e => setNhanhMat(e.target.value)}>
                <option value="">-- Chọn vật tư --</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name} (tồn: {m.tonKho} {m.unit})</option>)}
              </select>
            </FormRow>
            <FormRow label="Số lượng xuất" required>
              <input type="number" className={inputCls} value={nhanhSL} onChange={e => setNhanhSL(e.target.value)} placeholder="Số lượng" min={1} />
            </FormRow>
          </FormGrid>
        </FormSection>
      </ModalForm>

      {/* Form tạo MR */}
      {/* Modal Đề xuất Vật tư */}
      <ModalForm
        open={showMRForm}
        onClose={() => setShowMRForm(false)}
        title="Đề xuất Cấp Vật tư"
        subtitle="Lập phiếu đề xuất — gửi CH Phó duyệt"
        icon={<ClipboardCheck size={18}/>}
        color="emerald"
        width="lg"
        footer={<>

          <FormSection title="Ho so dinh kem">
            <FormFileUpload files={[]} onChange={()=>{}} accept=".pdf,.docx,.jpg" maxFiles={3} label="De nghi vat tu / Ho so lien quan"/>
          </FormSection>
                    <BtnCancel onClick={() => setShowMRForm(false)} />
          <BtnSubmit label="Nộp đề xuất" onClick={() => {
            if (!mrHangMuc.trim()) { notifErr('Vui lòng nhập hạng mục!'); return; }
            if (mrItems.some(i => !i.matHangId)) { notifErr('Vui lòng chọn đủ vật tư!'); return; }
            submitMR();
            setShowMRForm(false);
          }} />
        </>}
      >
        <FormSection title="Thông tin chung">
          <FormGrid cols={2}>
            <FormRow label="Người đề xuất" required>
              <input className={inputCls} value={mrForm2.nguoiLap} onChange={e => setMrForm2(v=>({...v,nguoiLap:e.target.value}))} placeholder="Họ tên người đề xuất" />
            </FormRow>
            <FormRow label="Chức vụ">
              <input className={inputCls} value={mrForm2.chucVuNguoiLap} onChange={e => setMrForm2(v=>({...v,chucVuNguoiLap:e.target.value}))} placeholder="VD: KS Thi công, CH Phó" />
            </FormRow>
            <FormRow label="Người nhận vật tư (trực tiếp)" required>
              <input className={inputCls} value={mrForm2.nguoiNhan} onChange={e => setMrForm2(v=>({...v,nguoiNhan:e.target.value}))} placeholder="Người trực tiếp nhận để thi công" />
            </FormRow>
            <FormRow label="Mức ưu tiên">
              <select className={selectCls} value={mrForm2.uuTien} onChange={e => setMrForm2(v=>({...v,uuTien:e.target.value as any}))}>
                <option value="normal">Bình thường</option>
                <option value="urgent">Khẩn cấp</option>
                <option value="critical">Rất khẩn — ảnh hưởng tiến độ</option>
              </select>
            </FormRow>
            <FormRow label="Hạng mục thi công" required>
              <input className={inputCls} value={mrHangMuc} onChange={e => setMrHangMuc(e.target.value)} placeholder="Hạng mục cần vật tư" />
            </FormRow>
            <FormRow label="Lý do / Ghi chú">
              <input className={inputCls} value={mrLyDo} onChange={e => setMrLyDo(e.target.value)} placeholder="Lý do đề xuất" />
            </FormRow>
            <FormRow label="Cần nhận trước ngày">
              <input type="date" className={inputCls} value={mrCanNgay} onChange={e => setMrCanNgay(e.target.value)} />
            </FormRow>
            <FormRow label="NCC gợi ý (nếu có)">
              <input className={inputCls} value={mrForm2.nccGoiY} onChange={e => setMrForm2(v=>({...v,nccGoiY:e.target.value}))} placeholder="Tên nhà cung cấp gợi ý" />
            </FormRow>
          </FormGrid>
        </FormSection>
        <FormSection title="Danh sách vật tư cần xuất">
          <div className="space-y-2">
            {mrItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 rounded-xl px-3 py-2">
                <select value={item.matHangId} onChange={e => {
                  const mat = materials.find(m => m.id === e.target.value);
                  setMrItems(mrItems.map((it,i) => i===idx ? {...it, matHangId:e.target.value, tenMatHang:mat?.name||'', donVi:mat?.unit||''} : it));
                }} className={`col-span-5 ${selectCls}`}>
                  <option value="">-- Chọn vật tư --</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
                <input type="number" placeholder="SL" value={item.soLuong} min={1}
                  onChange={e => setMrItems(mrItems.map((it,i) => i===idx ? {...it,soLuong:Number(e.target.value)} : it))}
                  className={`col-span-2 ${inputCls} text-center`} />
                <span className="col-span-1 text-[10px] text-slate-400 text-center">{item.donVi}</span>
                <input placeholder="Ghi chú" value={item.ghiChu}
                  onChange={e => setMrItems(mrItems.map((it,i) => i===idx ? {...it,ghiChu:e.target.value} : it))}
                  className={`col-span-3 ${inputCls}`} />
                <button onClick={() => setMrItems(mrItems.filter((_,i) => i!==idx))}
                  className="col-span-1 text-rose-400 hover:text-rose-600 flex justify-center"><X size={14}/></button>
              </div>
            ))}
            <button onClick={() => setMrItems([...mrItems, {matHangId:'',tenMatHang:'',donVi:'',soLuong:1,ghiChu:''}])}
              className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1">
              <Plus size={12}/> Thêm dòng vật tư
            </button>
          </div>
        </FormSection>
      </ModalForm>

      {printVoucher && <VoucherPrint
        data={{
          voucher: {
            id: printVoucher.code || printVoucher.id,
            type: printVoucher.type === 'PN' ? 'entry' : printVoucher.type === 'PX' ? 'exit' : 'return',
            date: printVoucher.ngay,
            material: printVoucher.items.map(i => i.matHang).join(', '),
            unit: printVoucher.items.length === 1 ? printVoucher.items[0].donVi : 'nhiều loại',
            qty: printVoucher.items.reduce((s, i) => s + i.soLuong, 0),
            unitPrice: printVoucher.items.length === 1 ? printVoucher.items[0].donGia : undefined,
            totalValue: printVoucher.totalAmount,
            supplier: printVoucher.nhaCungCap,
            requestedBy: printVoucher.nguoiLap,
            approvedBy: printVoucher.nguoiDuyet,
            notes: printVoucher.ghiChu,
            status: printVoucher.status,
            hangMuc: printVoucher.mucDich,
          },
          projectName,
          projectId,
        }}
        onClose={() => setPrintVoucher(null)}
      />}
      {printInventory && <InventoryPrint
        data={{
          kiemKe: {
            id: printInventory.id,
            date: printInventory.ngay,
            approvedBy: printInventory.nguoiDuyet,
            items: printInventory.items.map(i => ({
              name: i.tenMatHang,
              unit: i.donVi,
              soSach: i.soSach,
              thucTe: i.thucTe,
              chenh: i.chenhLech,
            })),
            notes: printInventory.ghiChu,
            status: printInventory.status,
          },
          projectName,
          projectId,
          auditRows: [...vouchers].sort((a,b) => b.id.localeCompare(a.id)).slice(0, 20).map(v => ({
            id: v.code || v.id,
            type: v.type,
            date: v.ngay,
            material: v.items.map(i => i.matHang).join(', '),
            unit: v.items[0]?.donVi || '',
            qty: v.items.reduce((s, i) => s + i.soLuong, 0),
          })),
        }}
        onClose={() => setPrintInventory(null)}
      />}
    </div>
  );
}