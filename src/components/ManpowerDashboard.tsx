// ManpowerDashboard.tsx — GEM&CLAUDE PM Pro
// Thiết kế mới hoàn toàn: 3 Views (Công trường / Nhân sự / Tháng này) + Drawer hồ sơ
// Không tab — chuyển view bằng toggle. Click người → drawer đầy đủ.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, HardHat, AlertTriangle, ChevronRight, Plus, Search,
  X, Printer, FileText, Download, Edit3, Save, Check,
  Calendar, XCircle, CheckCircle,
  UploadCloud, FileSpreadsheet, Zap,
  ChevronDown, ChevronUp, ClipboardList,
  DollarSign, Calculator, BarChart2,
  MapPin, Navigation, WifiOff, Lock, Unlock, TrendingUp, Briefcase,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { createDocument, submitDocument, getApprovalQueue, type ApprovalDoc } from './approvalEngine';
import { getCurrentMember, buildCtxFromMember } from './projectMember';
import ApprovalQueue from './ApprovalQueue';
import { loadProjectConfig, type ProjectConfig } from './ProjectConfigPanel';
import { ManpowerPrint, type ManpowerPrintData } from './PrintService';
import { db, useRealtimeSync } from './db';
import ShiftScheduleView from './ShiftScheduleView';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type PersonType = 'staff' | 'worker';
type ContractType = 'khong_xac_dinh' | 'xac_dinh' | 'nhan_cong' | 'thu_viec';
// present=cả ngày | half=nửa ngày | absent=vắng | leave=nghỉ phép
type AttendanceStatus = 'present' | 'half' | 'absent' | 'leave';
// Loại tăng ca theo BLLĐ 2019 Điều 97
type OtType = 'weekday' | 'weekend' | 'holiday';
type View = 'site' | 'people' | 'month' | 'shift';

interface Person {
  id: string;
  type: PersonType;
  name: string;
  jobTitle: string;
  team: string;
  contractor: string;
  phone: string;
  cccd: string;
  dob: string;
  address: string;
  joinDate: string;
  contractType: ContractType;
  contractNo: string;
  contractExpiry: string;
  bhxh: string;
  bhyt: string;
  salaryBase: number;    // cán bộ: K/tháng | công nhân: K/ngày
  allowance: number;     // phụ cấp cố định mỗi kỳ
  status: 'active' | 'leave' | 'resigned';
  isKeyPersonnel: boolean;
  bidCommitment: string;
  atlCert: string;
  atlExpiry: string;
  reportsTo: string;
}

interface DailyAttendance {
  personId: string;
  date: string;           // YYYY-MM-DD
  status: AttendanceStatus;
  otHours: number;        // số giờ tăng ca
  otType: OtType;         // loại tăng ca
  note: string;
}

interface MonthlyPayroll {
  personId: string;
  month: string;          // MM/YYYY — cán bộ dùng
  daysWorked: number;     // tổng ngày công (nửa ngày = 0.5)
  otWeekday: number;      // giờ OT ngày thường
  otWeekend: number;      // giờ OT cuối tuần
  otHoliday: number;      // giờ OT ngày lễ
  advances: number;       // tạm ứng (K)
  bonus: number;
  netPay: number;
}

// Kỳ công nhân — tuần hoặc 2 tuần
interface WorkerPeriodPayroll {
  personId: string;
  periodLabel: string;    // VD: "T2 10/03 - CN 16/03" hoặc "1-15/03/2026"
  periodStart: string;    // YYYY-MM-DD
  periodEnd: string;
  daysWorked: number;
  otWeekday: number;
  otWeekend: number;
  otHoliday: number;
  advances: number;
  netPay: number;
  confirmed: boolean;     // NTP đã xác nhận
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────

const SEED_PEOPLE: Person[] = [
  { id:'p1', type:'staff', name:'Trần Văn Bình', jobTitle:'Chỉ huy trưởng', team:'Ban Chỉ huy', contractor:'Nội bộ',
    phone:'0901234567', cccd:'079012345678', dob:'20/08/1980', address:'12 Lê Lợi, Q1, TP.HCM',
    joinDate:'01/01/2024', contractType:'khong_xac_dinh', contractNo:'HĐLĐ-2024-001', contractExpiry:'',
    bhxh:'BH-001-2024', bhyt:'YT-001-2024', salaryBase:35000, allowance:3000,
    status:'active', isKeyPersonnel:true, bidCommitment:'CHT full-time 100% thời gian dự án',
    atlCert:'', atlExpiry:'', reportsTo:'' },
  { id:'p2', type:'staff', name:'Lê Thị Thu', jobTitle:'Kỹ sư QA/QC', team:'Ban Chỉ huy', contractor:'Nội bộ',
    phone:'0912345678', cccd:'079023456789', dob:'10/12/1990', address:'45 Nguyễn Huệ, Q1, TP.HCM',
    joinDate:'01/01/2024', contractType:'xac_dinh', contractNo:'HĐLĐ-2024-002', contractExpiry:'31/12/2026',
    bhxh:'BH-002-2024', bhyt:'YT-002-2024', salaryBase:25000, allowance:2000,
    status:'active', isKeyPersonnel:true, bidCommitment:'KS QA/QC cấp 1',
    atlCert:'', atlExpiry:'', reportsTo:'p1' },
  { id:'p3', type:'staff', name:'Phạm Minh Quân', jobTitle:'Kỹ sư Giám sát', team:'Ban Chỉ huy', contractor:'Nội bộ',
    phone:'0923456789', cccd:'079034567890', dob:'05/04/1992', address:'78 Trần Hưng Đạo, Q5, TP.HCM',
    joinDate:'15/01/2024', contractType:'xac_dinh', contractNo:'HĐLĐ-2024-003', contractExpiry:'14/01/2026',
    bhxh:'BH-003-2024', bhyt:'YT-003-2024', salaryBase:22000, allowance:2000,
    status:'active', isKeyPersonnel:false, bidCommitment:'',
    atlCert:'', atlExpiry:'', reportsTo:'p1' },
  { id:'p4', type:'staff', name:'Hoàng Thị Mai', jobTitle:'Kế toán dự án', team:'Ban Chỉ huy', contractor:'Nội bộ',
    phone:'0934567890', cccd:'079045678901', dob:'22/11/1988', address:'99 Nguyễn Trãi, Q5, TP.HCM',
    joinDate:'01/01/2024', contractType:'khong_xac_dinh', contractNo:'HĐLĐ-2024-004', contractExpiry:'',
    bhxh:'BH-004-2024', bhyt:'YT-004-2024', salaryBase:20000, allowance:1500,
    status:'active', isKeyPersonnel:false, bidCommitment:'',
    atlCert:'', atlExpiry:'', reportsTo:'p1' },
  { id:'w1', type:'worker', name:'Nguyễn Văn Công', jobTitle:'Tổ trưởng Cốp pha', team:'Đội Cốp pha', contractor:'Phúc Thành',
    phone:'0945678901', cccd:'079056789012', dob:'15/03/1985', address:'Bình Dương',
    joinDate:'05/01/2024', contractType:'nhan_cong', contractNo:'HĐNC-2024-PT-001', contractExpiry:'31/12/2026',
    bhxh:'', bhyt:'', salaryBase:480, allowance:50,
    status:'active', isKeyPersonnel:false, bidCommitment:'',
    atlCert:'An toàn lao động Nhóm 3', atlExpiry:'15/01/2026', reportsTo:'p1' },
  { id:'w2', type:'worker', name:'Lê Minh Dũng', jobTitle:'Thợ cốp pha', team:'Đội Cốp pha', contractor:'Phúc Thành',
    phone:'0956789012', cccd:'079067890123', dob:'20/07/1990', address:'Đồng Nai',
    joinDate:'05/01/2024', contractType:'nhan_cong', contractNo:'HĐNC-2024-PT-002', contractExpiry:'31/12/2026',
    bhxh:'', bhyt:'', salaryBase:380, allowance:30,
    status:'active', isKeyPersonnel:false, bidCommitment:'',
    atlCert:'An toàn lao động Nhóm 3', atlExpiry:'20/08/2026', reportsTo:'w1' },
  { id:'w3', type:'worker', name:'Trần Văn Hùng', jobTitle:'Thợ nề', team:'Đội Hoàn thiện', contractor:'Phúc Thành',
    phone:'0967890123', cccd:'079078901234', dob:'12/05/1988', address:'Long An',
    joinDate:'10/01/2024', contractType:'nhan_cong', contractNo:'HĐNC-2024-PT-003', contractExpiry:'31/08/2026',
    bhxh:'', bhyt:'', salaryBase:360, allowance:30,
    status:'active', isKeyPersonnel:false, bidCommitment:'',
    atlCert:'An toàn lao động Nhóm 2', atlExpiry:'12/05/2025', reportsTo:'p1' },
  { id:'w4', type:'worker', name:'Phan Văn Đức', jobTitle:'Tổ trưởng Sắt', team:'Đội Sắt', contractor:'Thiên Long',
    phone:'0978901234', cccd:'079089012345', dob:'08/09/1983', address:'Tiền Giang',
    joinDate:'03/01/2024', contractType:'nhan_cong', contractNo:'HĐNC-2024-TL-001', contractExpiry:'31/12/2026',
    bhxh:'', bhyt:'', salaryBase:500, allowance:50,
    status:'active', isKeyPersonnel:false, bidCommitment:'',
    atlCert:'An toàn lao động Nhóm 3', atlExpiry:'08/09/2026', reportsTo:'p1' },
  { id:'w5', type:'worker', name:'Hoàng Minh Tuấn', jobTitle:'Thợ sắt', team:'Đội Sắt', contractor:'Thiên Long',
    phone:'0989012345', cccd:'079090123456', dob:'14/02/1994', address:'An Giang',
    joinDate:'03/01/2024', contractType:'nhan_cong', contractNo:'HĐNC-2024-TL-002', contractExpiry:'28/03/2026',
    bhxh:'', bhyt:'', salaryBase:400, allowance:30,
    status:'active', isKeyPersonnel:false, bidCommitment:'',
    atlCert:'Vận hành máy xây dựng', atlExpiry:'28/03/2026', reportsTo:'w4' },
  { id:'w6', type:'worker', name:'Lê Văn Đạt', jobTitle:'Thợ điện', team:'Đội MEP', contractor:'Thiên Long',
    phone:'0990123456', cccd:'079001234567', dob:'30/01/1992', address:'Cần Thơ',
    joinDate:'08/01/2024', contractType:'nhan_cong', contractNo:'HĐNC-2024-TL-003', contractExpiry:'31/12/2026',
    bhxh:'', bhyt:'', salaryBase:420, allowance:40,
    status:'active', isKeyPersonnel:false, bidCommitment:'',
    atlCert:'Điện công trường', atlExpiry:'10/01/2025', reportsTo:'p1' },
];

const COLORS = ['#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4'];
const CONTRACT_LABELS: Record<ContractType,string> = {
  khong_xac_dinh:'HĐLĐ không XĐ', xac_dinh:'HĐLĐ xác định',
  nhan_cong:'Hợp đồng nhân công', thu_viec:'Thử việc',
};
const TODAY = new Date().toISOString().slice(0,10);

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────

// localStorage helpers removed — all persistence via db.ts

// ─────────────────────────────────────────────────────────────────────────────
// GPS GEOFENCE HOOK
// ─────────────────────────────────────────────────────────────────────────────

/** Tính khoảng cách giữa 2 toạ độ (Haversine formula) — trả về mét */
function haversine(lat1:number, lon1:number, lat2:number, lon2:number): number {
  const R = 6371000;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

type GpsStatus = 'checking' | 'on_site' | 'off_site' | 'gps_error' | 'no_config' | 'disabled';

interface GpsState {
  status: GpsStatus;
  distance: number | null;   // mét, null nếu chưa có
  accuracy: number | null;   // mét, độ chính xác GPS
  coords: { lat:number; lng:number } | null;
}

function useGeofence(cfg: ProjectConfig | null): GpsState {
  const [state, setState] = useState<GpsState>({ status:'checking', distance:null, accuracy:null, coords:null });
  const watchId = useRef<number|null>(null);

  useEffect(()=>{
    if (!cfg?.gpsAttendanceEnabled) { setState(s=>({...s, status:'disabled'})); return; }
    const lat = parseFloat(cfg.siteLatitude||'');
    const lng = parseFloat(cfg.siteLongitude||'');
    const radius = parseFloat(cfg.siteRadius||'200');
    if (!lat || !lng) { setState(s=>({...s, status:'no_config'})); return; }

    if (!navigator.geolocation) { setState(s=>({...s, status:'gps_error'})); return; }

    setState(s=>({...s, status:'checking'}));

    watchId.current = navigator.geolocation.watchPosition(
      (pos)=>{
        const dist = haversine(pos.coords.latitude, pos.coords.longitude, lat, lng);
        setState({
          status: dist <= radius ? 'on_site' : 'off_site',
          distance: Math.round(dist),
          accuracy: Math.round(pos.coords.accuracy),
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      ()=>{ setState(s=>({...s, status:'gps_error', distance:null, accuracy:null})); },
      { enableHighAccuracy:true, timeout:10000, maximumAge:30000 }
    );

    return ()=>{ if (watchId.current!==null) navigator.geolocation.clearWatch(watchId.current); };
  }, [cfg?.gpsAttendanceEnabled, cfg?.siteLatitude, cfg?.siteLongitude, cfg?.siteRadius]);

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function daysUntil(ddmmyyyy:string):number {
  if (!ddmmyyyy) return Infinity;
  const [d,m,y] = ddmmyyyy.split('/');
  return Math.floor((new Date(`${y}-${m}-${d}`).getTime()-Date.now())/86400000);
}
function certStatus(expiry:string):'valid'|'expiring'|'expired'|'none' {
  if (!expiry) return 'none';
  const d = daysUntil(expiry);
  if (d<0) return 'expired'; if (d<=60) return 'expiring'; return 'valid';
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSON DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function PersonDrawer({ person, onClose, onSave, attendance }: {
  person:Person; onClose:()=>void; onSave:(p:Person)=>void; attendance:DailyAttendance[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Person>(person);
  const [tab, setTab] = useState<'profile'|'contract'|'atl'>('profile');
  useEffect(()=>{ setDraft(person); setEditing(false); setTab('profile'); },[person.id]);
  const set=(k:keyof Person,v:any)=>setDraft(d=>({...d,[k]:v}));
  const todayAtd = attendance.find(a=>a.personId===person.id && a.date===TODAY);
  const cst = certStatus(person.atlExpiry);
  const cdl = person.contractExpiry ? daysUntil(person.contractExpiry) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"/>
      <div className="relative w-full max-w-md bg-white h-full flex flex-col shadow-2xl" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${person.type==='staff'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>
            {person.name.split(' ').slice(-1)[0].slice(0,2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 truncate">{person.name}</p>
            <p className="text-xs text-slate-500">{person.jobTitle} · {person.team}</p>
          </div>
          <div className="flex gap-1.5">
            {editing
              ? <><button onClick={()=>{onSave(draft);setEditing(false);}} className="p-2 bg-teal-600 text-white rounded-xl"><Save size={15}/></button>
                  <button onClick={()=>{setDraft(person);setEditing(false);}} className="p-2 bg-slate-100 text-slate-600 rounded-xl"><X size={15}/></button></>
              : <button onClick={()=>setEditing(true)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"><Edit3 size={15}/></button>}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700"><X size={18}/></button>
          </div>
        </div>

        {/* Status strip */}
        <div className="px-5 py-2 bg-white border-b border-slate-100 flex flex-wrap gap-1.5 text-xs">
          <span className={`px-2 py-1 rounded-full font-bold text-xs ${
            todayAtd?.status==='present'?'bg-emerald-100 text-emerald-700':
            todayAtd?.status==='half'?'bg-teal-100 text-teal-700':
            todayAtd?.status==='absent'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'}`}>
            {todayAtd?.status==='present'?'✅ Có mặt':todayAtd?.status==='half'?'☀️ Nửa ngày':todayAtd?.status==='absent'?'❌ Vắng':'🌿 Nghỉ phép'}
            {todayAtd?.otHours?` · OT ${todayAtd.otHours}h (${todayAtd.otType==='weekday'?'1.5×':todayAtd.otType==='weekend'?'2×':'3×'})`:''}
          </span>
          {person.isKeyPersonnel && <span className="px-2 py-1 rounded-full font-bold bg-purple-100 text-purple-700">⭐ Nhân sự chủ chốt</span>}
          {cst==='expired' && <span className="px-2 py-1 rounded-full font-bold bg-rose-100 text-rose-700">⚠️ CC ATLĐ hết hạn</span>}
          {cst==='expiring' && <span className="px-2 py-1 rounded-full font-bold bg-amber-100 text-amber-700">⏰ CC ATLĐ sắp hết</span>}
          {cdl!==null && cdl<=45 && <span className="px-2 py-1 rounded-full font-bold bg-orange-100 text-orange-700">📄 HĐ còn {cdl} ngày</span>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-white">
          {(['profile','contract','atl'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${tab===t?'border-teal-600 text-teal-700':'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t==='profile'?'Hồ sơ':t==='contract'?'Hợp đồng':'ATLĐ'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {tab==='profile' && (
            <>
              {([['👤 Họ và tên','name'],['💼 Chức danh','jobTitle'],['🏗️ Đội','team'],['🏢 Nhà thầu / Đơn vị','contractor']] as [string,keyof Person][]).map(([lbl,key])=>(
                <div key={key as string} className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-400 mb-1">{lbl}</p>
                  {editing
                    ? <input value={String(draft[key]||'')} onChange={e=>set(key,e.target.value)} className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-400"/>
                    : <p className="text-sm font-medium text-slate-800">{String(person[key]||'—')}</p>}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                {([['📱 SĐT','phone'],['🪪 CCCD','cccd'],['🎂 Ngày sinh','dob'],['📅 Ngày vào','joinDate']] as [string,keyof Person][]).map(([lbl,key])=>(
                  <div key={key as string} className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-slate-400 mb-0.5">{lbl}</p>
                    {editing
                      ? <input value={String(draft[key]||'')} onChange={e=>set(key,e.target.value)} className="w-full text-xs font-medium bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none"/>
                      : <p className="text-xs font-medium text-slate-800">{String(person[key]||'—')}</p>}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-slate-400 mb-0.5">🏦 BHXH</p>
                  {editing ? <input value={draft.bhxh} onChange={e=>set('bhxh',e.target.value)} className="w-full text-xs font-medium bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none"/>
                    : <p className={`text-xs font-medium ${person.bhxh?'text-slate-800':'text-rose-500'}`}>{person.bhxh||'⚠️ Chưa có'}</p>}
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-slate-400 mb-0.5">🏥 BHYT</p>
                  {editing ? <input value={draft.bhyt} onChange={e=>set('bhyt',e.target.value)} className="w-full text-xs font-medium bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none"/>
                    : <p className="text-xs font-medium text-slate-800">{person.bhyt||'—'}</p>}
                </div>
              </div>
              {person.isKeyPersonnel && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-purple-600 font-bold mb-1">⭐ CAM KẾT HỒ SƠ THẦU</p>
                  {editing ? <input value={draft.bidCommitment} onChange={e=>set('bidCommitment',e.target.value)} className="w-full text-xs font-medium bg-white border border-purple-200 rounded px-2 py-1 focus:outline-none"/>
                    : <p className="text-xs text-purple-800">{person.bidCommitment||'Chưa ghi cam kết'}</p>}
                </div>
              )}
            </>
          )}

          {tab==='contract' && (
            <>
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[10px] text-slate-400 mb-1">📄 Loại hợp đồng</p>
                {editing
                  ? <select value={draft.contractType} onChange={e=>set('contractType',e.target.value)} className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
                      {Object.entries(CONTRACT_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  : <p className="text-sm font-medium text-slate-800">{CONTRACT_LABELS[person.contractType]}</p>}
              </div>
              {([['🔢 Số hợp đồng','contractNo'],['📅 Ngày hết hạn','contractExpiry']] as [string,keyof Person][]).map(([lbl,key])=>(
                <div key={key as string} className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-400 mb-1">{lbl}</p>
                  {editing ? <input value={String(draft[key]||'')} onChange={e=>set(key,e.target.value)} placeholder={key==='contractExpiry'?'DD/MM/YYYY':''} className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"/>
                    : <div>
                        <p className="text-sm font-medium text-slate-800">{String(person[key]||'—')}</p>
                        {key==='contractExpiry' && cdl!==null && cdl<=45 && <p className="text-[10px] text-amber-600 font-bold mt-0.5">⚠️ Còn {cdl} ngày — cần gia hạn</p>}
                        {key==='contractExpiry' && cdl!==null && cdl<0 && <p className="text-[10px] text-rose-600 font-bold mt-0.5">❌ Đã hết hạn {Math.abs(cdl)} ngày</p>}
                      </div>}
                </div>
              ))}
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[10px] text-slate-400 mb-1">💰 Lương cơ bản</p>
                {editing ? <input type="number" value={draft.salaryBase} onChange={e=>set('salaryBase',Number(e.target.value))} className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"/>
                  : <p className="text-sm font-medium text-slate-800">{person.salaryBase.toLocaleString()}K đ/{person.type==='worker'?'ngày':'tháng'}</p>}
              </div>
            </>
          )}

          {tab==='atl' && (
            <>
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[10px] text-slate-400 mb-1">🛡️ Loại chứng chỉ ATLĐ</p>
                {editing
                  ? <select value={draft.atlCert} onChange={e=>set('atlCert',e.target.value)} className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
                      <option value="">Không có</option>
                      {['An toàn lao động Nhóm 1','An toàn lao động Nhóm 2','An toàn lao động Nhóm 3','An toàn lao động Nhóm 4','An toàn lao động Nhóm 5','Điện công trường','Làm việc trên cao','Vận hành máy xây dựng','PCCC cơ bản','Sơ cứu y tế'].map(v=><option key={v}>{v}</option>)}
                    </select>
                  : <p className="text-sm font-medium text-slate-800">{person.atlCert||'Không yêu cầu'}</p>}
              </div>
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[10px] text-slate-400 mb-1">📅 Ngày hết hạn</p>
                {editing ? <input value={draft.atlExpiry} onChange={e=>set('atlExpiry',e.target.value)} placeholder="DD/MM/YYYY" className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"/>
                  : <div>
                      <p className="text-sm font-medium text-slate-800">{person.atlExpiry||'—'}</p>
                      {person.atlExpiry && (() => {
                        const d = daysUntil(person.atlExpiry);
                        return <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${d<0?'bg-rose-100 text-rose-700':d<=60?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>
                          {d<0?`Hết hạn ${Math.abs(d)} ngày trước`:d<=60?`Còn ${d} ngày`:'Còn hạn'}
                        </span>;
                      })()}
                    </div>}
              </div>
              {!person.atlCert && person.type==='worker' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5"/>
                  <p className="text-xs text-amber-800">Công nhân thi công bắt buộc phải có chứng chỉ ATLĐ theo Thông tư 06/2020/TT-BLĐTBXH.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

import type { DashboardProps } from './types';

type Props = DashboardProps & { initialTab?: string };

export default function ManpowerDashboard({ project, initialTab }:Props) {
  const pid = project?.id || 'default';
  const projectName = project?.name || 'Dự án';

  const TAB_TO_VIEW: Record<string, View> = { site: 'site', people: 'people', month: 'month', staff: 'people', shift: 'shift' };
  const [view, setView] = useState<View>(() => (initialTab && TAB_TO_VIEW[initialTab]) ? TAB_TO_VIEW[initialTab] : 'site');
  const [people, setPeople]         = useState<Person[]>(SEED_PEOPLE);
  const [attendance, setAttendance] = useState<DailyAttendance[]>([]);
  const [dbLoaded, setDbLoaded]     = useState(false);

  // ── Load from db on mount ──────────────────────────────────────────────────
  useEffect(() => {
    setDbLoaded(false);
    Promise.all([
      db.get<Person[]>('mp_people', pid, SEED_PEOPLE),
      db.get<DailyAttendance[]>('mp_attendance', pid, []),
    ]).then(([ppl, saved]) => {
      setPeople(ppl);
      if (!saved.find((a: DailyAttendance) => a.date === TODAY)) {
        const seed = SEED_PEOPLE.map(p=>({ personId:p.id, date:TODAY, status:(p.id==='w3'?'absent':p.id==='w5'?'leave':'present') as AttendanceStatus, otHours:['p1','w1','w4'].includes(p.id)?2:0, otType:'weekday' as OtType, note:'' }));
        setAttendance([...saved, ...seed]);
      } else {
        setAttendance(saved);
      }
      setDbLoaded(true);
    });
  }, [pid]);
  const [selectedPerson, setSelectedPerson] = useState<Person|null>(null);
  const [searchQ, setSearchQ]   = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterType, setFilterType] = useState<'all'|'staff'|'worker'>('all');
  const [showApproval, setShowApproval] = useState(false);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalDoc[]>([]);
  const [printMp, setPrintMp] = useState<ManpowerPrintData|null>(null);
  const [orgExpanded, setOrgExpanded] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(false);
  const [payrollDraft, setPayrollDraft] = useState<Record<string,{daysWorked?:number;otWeekday?:number;otWeekend?:number;otHoliday?:number;advances?:number}>>({});

  const cfg:ProjectConfig|null = loadProjectConfig(pid);
  const currentMonth = new Date().toLocaleDateString('vi-VN',{month:'2-digit',year:'numeric'});

  // ── Phân quyền: lấy member hiện tại ──────────────────────────────────────
  const currentMember = getCurrentMember(pid);
  const currentCtx    = buildCtxFromMember(currentMember);
  const roleId        = currentMember?.activeRoleId || 'chi_huy_truong';
  // THT chỉ được chấm công nhân của đội mình
  const isTHT     = roleId === 'to_truong' || roleId === 'thi_cong_vien';
  const myTeam    = null; // teamScope không tồn tại trong ProjectMember
  // CHT, HR, Giám đốc được override tất cả
  const canOverride = !isTHT;

  // ── GPS Geofence ──────────────────────────────────────────────────────────
  const gps = useGeofence(cfg);
  // THT bị khóa chấm công khi GPS enabled nhưng off_site / lỗi
  // Chỉ block khi GPS được bật, user là THT, và đang ngoài vùng hoặc lỗi GPS
  // Khi GPS chưa cấu hình (no_config/disabled) → cho phép chấm công thủ công
  const gpsBlocked = cfg?.gpsAttendanceEnabled && isTHT &&
    (gps.status === 'off_site' || gps.status === 'gps_error');

useEffect(()=>{ if (dbLoaded) db.set('mp_people', pid, people); },[people, pid]);

  // ── Realtime sync ──────────────────────────────────────────────────────────
  useRealtimeSync(pid, ['mp_people', 'mp_attendance'], async () => {
    const [ppl, att] = await Promise.all([
      db.get<Person[]>('mp_people', pid, SEED_PEOPLE),
      db.get<DailyAttendance[]>('mp_attendance', pid, []),
    ]);
    setPeople(ppl);
    setAttendance(att);
  });

  // ── gem:open-action — WorkspaceActionBar trigger ─────────────────────────
  React.useEffect(() => {
    const handler = (e: Event) => {
      const { actionId } = (e as CustomEvent).detail;
      if (actionId === 'TIMESHEET')        { setView('site'); }
      if (actionId === 'OVERTIME_REQUEST') { setView('site'); }
    };
    window.addEventListener('gem:open-action', handler);
    return () => window.removeEventListener('gem:open-action', handler);
  }, []);
  useEffect(()=>{ if(dbLoaded && attendance.length) db.set('mp_attendance', pid, attendance); },[attendance, pid]);
  useEffect(()=>{
    const member = getCurrentMember(pid);
    const ctx = buildCtxFromMember(member);
    setApprovalQueue(getApprovalQueue(pid, ctx));
  },[pid]);

  const activePeople  = people.filter(p=>p.status==='active');
  // THT chỉ thấy đội mình, CHT thấy tất cả
  // Tất cả role đều thấy danh sách nhân sự — THT quản lý đội mình, CHT/HR thấy tất cả
  const myPeople = activePeople;
  const todayPresent  = attendance.filter(a=>a.date===TODAY && (a.status==='present'||a.status==='half')).length;
  const todayAbsent   = attendance.filter(a=>a.date===TODAY && a.status==='absent').length;
  const todayHalf     = attendance.filter(a=>a.date===TODAY && a.status==='half').length;
  const teams = ['all',...Array.from(new Set(activePeople.map(p=>p.team)))];
  const contractors = Array.from(new Set(activePeople.filter(p=>p.type==='worker').map(p=>p.contractor)));

  const expiredCerts  = activePeople.filter(p=>certStatus(p.atlExpiry)==='expired').length;
  const expiringCerts = activePeople.filter(p=>certStatus(p.atlExpiry)==='expiring').length;
  const expiredContracts = activePeople.filter(p=>{ const d=daysUntil(p.contractExpiry); return d<Infinity&&d<=45; }).length;
  const noBhxh = activePeople.filter(p=>p.type==='staff'&&!p.bhxh).length;

  const filteredPeople = activePeople.filter(p=>{
    const q = searchQ.toLowerCase();
    return (!q || [p.name,p.jobTitle,p.contractor,p.team].some(s=>s.toLowerCase().includes(q)))
      && (filterTeam==='all'||p.team===filterTeam)
      && (filterType==='all'||p.type===filterType);
  });

  const laborChart = Array.from(new Set(activePeople.map(p=>p.team))).map((team,i)=>({
    name:team, value:activePeople.filter(p=>p.team===team).length, fill:COLORS[i%COLORS.length],
  }));

  const teamGroups = contractors.map(c=>({
    name:c,
    teams: Array.from(new Set(activePeople.filter(p=>p.contractor===c&&p.type==='worker').map(p=>p.team))).map(team=>({
      name:team,
      count:activePeople.filter(p=>p.team===team).length,
      present:attendance.filter(a=>a.date===TODAY&&a.status==='present'&&activePeople.find(p=>p.id===a.personId&&p.team===team)).length,
    }))
  }));

  const savePerson = useCallback((updated:Person)=>{
    setPeople(prev=>prev.map(p=>p.id===updated.id?updated:p));
    setSelectedPerson(updated);
  },[]);

  const toggleAttendance = (personId:string, status:AttendanceStatus) => {
    setAttendance(prev=>{
      const idx = prev.findIndex(a=>a.personId===personId&&a.date===TODAY);
      if (idx>=0) { const copy=[...prev]; copy[idx]={...copy[idx],status}; return copy; }
      return [...prev,{personId,date:TODAY,status,otHours:0,otType:'weekday',note:''}];
    });
  };

  const setOtHours = (personId:string, otHours:number, otType:OtType='weekday') => {
    setAttendance(prev=>{
      const idx = prev.findIndex(a=>a.personId===personId&&a.date===TODAY);
      if (idx>=0) { const copy=[...prev]; copy[idx]={...copy[idx],otHours,otType}; return copy; }
      return [...prev,{personId,date:TODAY,status:'present',otHours,otType,note:''}];
    });
  };

  const submitTimesheet = () => {
    const member = getCurrentMember(pid);
    const ctx = buildCtxFromMember(member);
    const cr = createDocument({ projectId: pid, docType: 'TIMESHEET', title: `Bảng công ${currentMonth}`, data: { ref: `TS-${currentMonth}` }, ctx });
    if (cr.ok) { submitDocument(pid,cr.data!.id,ctx); setApprovalQueue(getApprovalQueue(pid,ctx)); }
  };

  const stdDays    = Number(cfg?.workingDaysPerMonth || 26);
  const hoursPerDay= Number(cfg?.workingHoursPerDay  || 8);
  const rateWd     = Number(cfg?.otRateWeekday       || 1.5);
  const rateWe     = Number(cfg?.otRateWeekend       || 2.0);
  const rateHol    = Number(cfg?.otRateHoliday       || 3.0);

  return (
    <div className="space-y-4 pb-8">

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Quản lý Nhân lực</h2>
            <p className="text-xs text-slate-500">{projectName} · {activePeople.length} người đang làm việc</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {approvalQueue.length>0 && (
              <button onClick={()=>setShowApproval(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors">
                <ClipboardList size={13}/> Duyệt ({approvalQueue.length})
              </button>
            )}
            <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200">
              {([['site','🏗️ Công trường'],['people','👥 Nhân sự'],['month','📊 Tháng này'],['shift','🔄 Lịch 3 ca']] as [View,string][]).map(([v,lbl])=>(
                <button key={v} onClick={()=>setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${view===v?'bg-white text-slate-800 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
        {(expiredCerts+expiringCerts+expiredContracts+noBhxh)>0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {expiredCerts>0 && <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-xs font-bold">⚠️ {expiredCerts} CC hết hạn</span>}
            {expiringCerts>0 && <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold">⏰ {expiringCerts} CC sắp hết</span>}
            {expiredContracts>0 && <span className="px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 rounded-full text-xs font-bold">📄 {expiredContracts} HĐ sắp hết hạn</span>}
            {noBhxh>0 && <span className="px-3 py-1 bg-slate-100 border border-slate-300 text-slate-600 rounded-full text-xs font-bold">🏦 {noBhxh} chưa có BHXH</span>}
          </div>
        )}
      </div>

      {/* ══ VIEW: CÔNG TRƯỜNG ══ */}
      {view==='site' && (
        <div className="space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {label:'Tổng quân số',value:activePeople.length,unit:'người',color:'border-blue-200 bg-blue-50',text:'text-blue-700',icon:<Users size={18}/>},
              {label:'Có mặt hôm nay',value:todayPresent,unit:`người${todayHalf>0?` (${todayHalf} nửa ngày)`:''}`,color:'border-emerald-200 bg-emerald-50',text:'text-emerald-700',icon:<CheckCircle size={18}/>},
              {label:'Vắng mặt',value:todayAbsent,unit:'người',color:'border-rose-200 bg-rose-50',text:'text-rose-700',icon:<XCircle size={18}/>},
              {label:'Đội thi công',value:contractors.length,unit:'NTP',color:'border-amber-200 bg-amber-50',text:'text-amber-700',icon:<HardHat size={18}/>},
            ].map(k=>(
              <div key={k.label} className={`${k.color} border rounded-2xl p-4 flex items-center gap-3`}>
                <div className={`${k.text} shrink-0`}>{k.icon}</div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium leading-tight">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.text}`}>{k.value} <span className="text-sm font-normal text-slate-400">{k.unit}</span></p>
                </div>
              </div>
            ))}
          </div>

          {/* GPS Status Bar */}
          {cfg?.gpsAttendanceEnabled && (
            <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 border ${
              gps.status==='on_site'  ? 'bg-emerald-50 border-emerald-200' :
              gps.status==='off_site' ? 'bg-rose-50 border-rose-200' :
              gps.status==='checking' ? 'bg-blue-50 border-blue-200' :
              gps.status==='gps_error'? 'bg-amber-50 border-amber-200' :
                                        'bg-slate-50 border-slate-200'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                gps.status==='on_site'?'bg-emerald-600':gps.status==='off_site'?'bg-rose-500':
                gps.status==='checking'?'bg-blue-500':'bg-amber-500'}`}>
                {gps.status==='on_site'   ? <Navigation size={16} className="text-white"/> :
                 gps.status==='off_site'  ? <Lock size={16} className="text-white"/> :
                 gps.status==='gps_error' ? <WifiOff size={16} className="text-white"/> :
                                            <MapPin size={16} className="text-white animate-pulse"/>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${
                  gps.status==='on_site'?'text-emerald-800':gps.status==='off_site'?'text-rose-800':
                  gps.status==='checking'?'text-blue-800':'text-amber-800'}`}>
                  {gps.status==='on_site'   ? `✅ Trong vùng công trường${gps.distance!=null?` — cách tâm ${gps.distance}m`:''}` :
                   gps.status==='off_site'  ? `🔒 Ngoài vùng công trường — cách ${gps.distance}m (bán kính ${cfg.siteRadius}m)` :
                   gps.status==='checking'  ? '📡 Đang xác định vị trí GPS...' :
                   gps.status==='gps_error' ? '⚠️ Không thể lấy GPS — kiểm tra quyền định vị' :
                                              'GPS chấm công đã tắt'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {gps.accuracy!=null ? `Độ chính xác: ±${gps.accuracy}m · ` : ''}
                  {isTHT
                    ? gps.status==='on_site' ? 'Bạn có thể chấm công' : 'THT phải ở trong vùng mới chấm được'
                    : 'CHT/HR có thể override bất kỳ lúc nào'}
                </p>
              </div>
              {gps.status==='on_site' && (
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded-full font-bold shrink-0">GPS ✓</span>
              )}
            </div>
          )}

          {/* Điểm danh nhanh */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-teal-600"/>
                <h3 className="font-bold text-slate-800 text-sm">Điểm danh hôm nay</h3>
                <span className="text-xs text-slate-400">{new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</span>
                {isTHT && myTeam && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Đội {myTeam}</span>
                )}
              </div>
              <button onClick={()=>setPrintMp({type:'overview', projectName, stats:{total:activePeople.length,present:todayPresent,roles:laborChart.map(c=>({name:c.name,count:c.value}))}})}
                className="text-xs text-slate-500 hover:text-teal-600 flex items-center gap-1">
                <Printer size={13}/> In
              </button>
            </div>

            {/* Locked overlay khi THT ngoài vùng */}
            {gpsBlocked ? (
              <div className="px-6 py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
                  <Lock size={24} className="text-rose-500"/>
                </div>
                <p className="font-bold text-slate-700 text-sm mb-1">Chấm công bị khóa</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {gps.status==='checking'
                    ? 'Đang xác định vị trí GPS... Vui lòng chờ.'
                    : gps.status==='gps_error'
                    ? 'Không lấy được tín hiệu GPS. Bật định vị và thử lại.'
                    : `Bạn đang cách công trường ${gps.distance}m. Phải vào trong vùng ${cfg?.siteRadius||200}m mới chấm được.`}
                </p>
                {gps.status==='gps_error' && (
                  <button onClick={()=>window.location.reload()}
                    className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold">
                    Thử lại GPS
                  </button>
                )}
              </div>
            ) : (
            <div className="divide-y divide-slate-50">
              {myPeople.map(p=>{
                const atd = attendance.find(a=>a.personId===p.id&&a.date===TODAY);
                const st = atd?.status||'present';
                const otH = atd?.otHours||0;
                const otT = atd?.otType||'weekday';
                // tính ngày công hiển thị
                const dayVal = st==='present'?1:st==='half'?0.5:0;
                return (
                  <div key={p.id} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Avatar + tên */}
                      <div onClick={()=>setSelectedPerson(p)} className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${p.type==='staff'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>
                          {p.name.split(' ').slice(-1)[0].slice(0,2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{p.jobTitle} · {p.team}</p>
                        </div>
                      </div>
                      {/* Trạng thái — 4 nút */}
                      <div className="flex items-center gap-1 shrink-0">
                        {([
                          ['present','✅','Cả ngày','bg-emerald-600'],
                          ['half','☀️','Nửa ngày','bg-teal-500'],
                          ['leave','🌿','Nghỉ phép','bg-amber-500'],
                          ['absent','❌','Vắng','bg-rose-600'],
                        ] as [AttendanceStatus,string,string,string][]).map(([s,icon,tip,active])=>(
                          <button key={s} onClick={()=>toggleAttendance(p.id,s)} title={tip}
                            className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${st===s?`${active} text-white shadow-sm scale-110`:'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                            {icon}
                          </button>
                        ))}
                      </div>
                      {/* Ngày công */}
                      <div className="w-10 text-center shrink-0">
                        <span className={`text-sm font-bold ${dayVal===1?'text-emerald-600':dayVal===0.5?'text-teal-600':'text-slate-300'}`}>{dayVal>0?dayVal:''}</span>
                        {dayVal>0 && <p className="text-[9px] text-slate-400">công</p>}
                      </div>
                    </div>
                    {/* OT row — chỉ hiện khi có mặt */}
                    {(st==='present'||st==='half') && (
                      <div className="mt-2 ml-10 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 shrink-0">Tăng ca:</span>
                        <input
                          type="number" min="0" max="12" step="0.5"
                          value={otH||''}
                          onChange={e=>setOtHours(p.id, Number(e.target.value), otT)}
                          placeholder="0"
                          className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center font-bold text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        />
                        <span className="text-[10px] text-slate-400">giờ ×</span>
                        <select value={otT} onChange={e=>setOtHours(p.id, otH, e.target.value as OtType)}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200">
                          <option value="weekday">1.5× ngày thường</option>
                          <option value="weekend">2.0× cuối tuần</option>
                          <option value="holiday">3.0× ngày lễ</option>
                        </select>
                        {otH>0 && (
                          <span className="text-[10px] font-bold text-orange-600">
                            = {otH}h × {otT==='weekday'?'1.5':otT==='weekend'?'2.0':'3.0'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Charts + Orgchart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Phân bổ theo đội</h3>
              <ResponsiveContainer width="100%" height={180} minWidth={0}>
                <PieChart>
                  <Pie data={laborChart} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {laborChart.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                  </Pie>
                  <Tooltip formatter={(v:any)=>[`${v} người`,'Quân số']}/>
                  <Legend wrapperStyle={{fontSize:10}} iconSize={10}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 text-sm">Ban Chỉ huy</h3>
                <button onClick={()=>setOrgExpanded(v=>!v)} className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                  {orgExpanded?<><ChevronUp size={13}/>Thu gọn</>:<><ChevronDown size={13}/>Mở rộng</>}
                </button>
              </div>
              <div className={`space-y-1 ${!orgExpanded?'max-h-44 overflow-hidden':''}`}>
                {activePeople.filter(p=>p.type==='staff').map(p=>(
                  <div key={p.id} onClick={()=>setSelectedPerson(p)}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                    style={{paddingLeft:p.reportsTo?'2rem':'0.5rem'}}>
                    {p.reportsTo && <div className="w-3 h-px bg-slate-300 shrink-0"/>}
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {p.name.split(' ').slice(-1)[0].slice(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.jobTitle}</p>
                    </div>
                    {p.isKeyPersonnel && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">Chủ chốt</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Đội NTP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teamGroups.map(g=>(
              <div key={g.name} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">NTP: {g.name}</p>
                {g.teams.map(t=>(
                  <div key={t.name} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <HardHat size={13} className="text-amber-500 shrink-0"/>
                      <span className="text-xs font-medium text-slate-700">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-600 font-bold">{t.present}</span>
                      <span className="text-[10px] text-slate-400">/ {t.count}</span>
                      <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{width:`${t.count?t.present/t.count*100:0}%`}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ VIEW: NHÂN SỰ ══ */}
      {view==='people' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                placeholder="Tìm tên, chức danh, đội, nhà thầu..."
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"/>
            </div>
            <select value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none">
              {teams.map(t=><option key={t} value={t}>{t==='all'?'Tất cả đội':t}</option>)}
            </select>
            <select value={filterType} onChange={e=>setFilterType(e.target.value as any)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none">
              <option value="all">Tất cả</option>
              <option value="staff">Ban chỉ huy</option>
              <option value="worker">Công nhân</option>
            </select>
            <button onClick={()=>setPeople(prev=>[...prev,{
              id:`p${Date.now()}`,type:'worker',name:'Nhân sự mới',jobTitle:'',team:'',contractor:'',
              phone:'',cccd:'',dob:'',address:'',joinDate:new Date().toLocaleDateString('vi-VN'),
              contractType:'nhan_cong',contractNo:'',contractExpiry:'',bhxh:'',bhyt:'',
              salaryBase:0,allowance:0,status:'active',isKeyPersonnel:false,bidCommitment:'',
              atlCert:'',atlExpiry:'',reportsTo:'',
            }])}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-colors shrink-0">
              <Plus size={15}/> Thêm người
            </button>
          </div>

          <div className="space-y-2">
            {filteredPeople.length===0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <Users size={32} className="text-slate-300 mx-auto mb-2"/>
                <p className="text-slate-400 text-sm">Không tìm thấy ai</p>
              </div>
            )}
            {filteredPeople.map(p=>{
              const atd = attendance.find(a=>a.personId===p.id&&a.date===TODAY);
              const cst = certStatus(p.atlExpiry);
              const cdl = p.contractExpiry ? daysUntil(p.contractExpiry) : null;
              return (
                <div key={p.id} onClick={()=>setSelectedPerson(p)}
                  className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md hover:border-teal-200 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${p.type==='staff'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>
                      {p.name.split(' ').slice(-1)[0].slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800">{p.name}</p>
                        {p.isKeyPersonnel && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold">⭐ Chủ chốt</span>}
                        {atd?.status==='absent' && <span className="text-[9px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full font-bold">Vắng hôm nay</span>}
                      </div>
                      <p className="text-xs text-slate-500">{p.jobTitle} · {p.team} · {p.contractor}</p>
                    </div>
                    <div className="shrink-0 text-right hidden sm:block space-y-0.5">
                      {cst==='expired' && <p className="text-[10px] text-rose-600 font-bold">⚠️ CC hết hạn</p>}
                      {cst==='expiring' && <p className="text-[10px] text-amber-600 font-bold">⏰ CC sắp hết</p>}
                      {cdl!==null && cdl<=45 && <p className="text-[10px] text-orange-600 font-bold">📄 HĐ còn {cdl}ng</p>}
                      {!p.bhxh && p.type==='staff' && <p className="text-[10px] text-slate-500">Chưa BHXH</p>}
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-500 transition-colors shrink-0"/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Xuất pháp lý */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">📋 Xuất báo cáo pháp lý</p>
            <div className="flex flex-wrap gap-2">
              {['Danh sách lao động (mẫu thanh tra)','Bảng kê BHXH','Xác nhận nhân sự chủ chốt (TVGS)','Danh sách hợp đồng nhân công'].map(lbl=>(
                <button key={lbl} onClick={()=>setPrintMp({type:'overview', projectName, stats:{total:activePeople.length,present:todayPresent,roles:laborChart.map(c=>({name:c.name,count:c.value}))}})}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors">
                  <Download size={12}/> {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ VIEW: THÁNG NÀY ══ */}
      {view==='month' && (
        <div className="space-y-4">

          {/* Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-slate-800">Bảng công · Bảng lương</h3>
              <p className="text-xs text-slate-500">
                Tháng {currentMonth} · {stdDays} ngày chuẩn · Cán bộ trả ngày {cfg?.staffPayDay||5}
                {cfg?.workerPayCycle==='week' ? ' · CN thanh toán hàng tuần' : cfg?.workerPayCycle==='biweek' ? ' · CN thanh toán 2 tuần/lần' : ' · CN trả cùng cán bộ'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={()=>setEditingPayroll(v=>!v)}
                  className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${editingPayroll?'bg-teal-600':'bg-slate-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${editingPayroll?'translate-x-5':''}`}/>
                </div>
                <span className="text-xs font-medium text-slate-600">Chỉnh sửa</span>
              </label>
              <button onClick={submitTimesheet}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors">
                <Check size={13}/> Nộp duyệt
              </button>
              <button onClick={()=>setPrintMp({type:'timesheet', projectName, period:currentMonth,
                timesheetRows:activePeople.map(p=>({
                  name:p.name, role:p.jobTitle, days:Array(31).fill(''),
                  total: (() => {
                    const att = attendance.filter(a=>a.personId===p.id);
                    return att.reduce((s,a)=>s+(a.status==='present'?1:a.status==='half'?0.5:0),0)||23;
                  })(),
                  ot: attendance.filter(a=>a.personId===p.id).reduce((s,a)=>s+a.otHours,0),
                }))
              })}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors">
                <Printer size={13}/> In bảng công
              </button>
            </div>
          </div>

          {/* Hệ số OT hiện tại */}
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Ngày thường','otRateWeekday', cfg?.otRateWeekday||'1.5','bg-orange-50 border-orange-200 text-orange-700'],
              ['Cuối tuần','otRateWeekend', cfg?.otRateWeekend||'2.0','bg-amber-50 border-amber-200 text-amber-700'],
              ['Ngày lễ','otRateHoliday', cfg?.otRateHoliday||'3.0','bg-rose-50 border-rose-200 text-rose-700'],
            ].map(([lbl,,val,cls])=>(
              <div key={lbl} className={`${cls} border rounded-xl px-3 py-2 flex items-center gap-2`}>
                <TrendingUp size={12} className="shrink-0"/>
                <div>
                  <p className="text-[10px] font-bold">{lbl}</p>
                  <p className="text-sm font-bold">{val}×</p>
                </div>
              </div>
            ))}
          </div>

          {/* ══ BẢNG CÁN BỘ (lương tháng) ══ */}
          <div className="bg-white border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-blue-50/60 border-b border-blue-100 flex items-center gap-2">
              <Briefcase size={13} className="text-blue-600"/>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Cán bộ Ban Chỉ huy — Lương tháng</p>
              <span className="ml-auto text-[10px] text-blue-500">Công thức: Lương CB / {stdDays} ngày × Ngày công + OT + Phụ cấp − BHXH − Thuế − Tạm ứng</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cán bộ</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ngày công</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">OT thường (h)</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">OT CN (h)</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">OT lễ (h)</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tạm ứng (K)</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Thực nhận (K)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activePeople.filter(p=>p.type==='staff').map(p=>{
                    // Tính từ attendance thực tế
                    const att = attendance.filter(a=>a.personId===p.id);
                    const daysFromAtt = att.reduce((s,a)=>s+(a.status==='present'?1:a.status==='half'?0.5:0),0);
                    const base   = payrollDraft[p.id]?.daysWorked ?? (daysFromAtt||23);
                    const otWd   = payrollDraft[p.id]?.otWeekday  ?? att.filter(a=>a.otType==='weekday').reduce((s,a)=>s+a.otHours,0);
                    const otWe   = payrollDraft[p.id]?.otWeekend  ?? att.filter(a=>a.otType==='weekend').reduce((s,a)=>s+a.otHours,0);
                    const otHol  = payrollDraft[p.id]?.otHoliday  ?? att.filter(a=>a.otType==='holiday').reduce((s,a)=>s+a.otHours,0);
                    const adv    = payrollDraft[p.id]?.advances   ?? 0;
                    const hrRate = p.salaryBase / stdDays / hoursPerDay;
                    const otPay  = otWd*hrRate*rateWd + otWe*hrRate*rateWe + otHol*hrRate*rateHol;
                    const bhxh   = p.salaryBase * 0.105; // BHXH 8% + BHYT 1.5% + BHTN 1%
                    const gross  = (p.salaryBase/stdDays)*base + otPay + p.allowance;
                    const net    = Math.round(gross - bhxh - adv);
                    return (
                      <tr key={p.id} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {p.name.split(' ').slice(-1)[0].slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{p.name}</p>
                              <p className="text-[10px] text-slate-400">{p.jobTitle} · {p.salaryBase.toLocaleString()}K/tháng</p>
                            </div>
                          </div>
                        </td>
                        {/* Ngày công */}
                        <td className="px-3 py-3 text-center">
                          {editingPayroll
                            ? <input type="number" step="0.5" defaultValue={base}
                                onChange={e=>setPayrollDraft(d=>({...d,[p.id]:{...d[p.id],daysWorked:Number(e.target.value)}}))}
                                className="w-14 text-center border border-blue-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                            : <span className={`font-bold ${base>=stdDays-1?'text-emerald-600':base>=stdDays-3?'text-amber-600':'text-rose-600'}`}>{base}</span>}
                        </td>
                        {/* OT 3 loại */}
                        {[['otWeekday',otWd,'text-orange-500'],['otWeekend',otWe,'text-amber-500'],['otHoliday',otHol,'text-rose-500']].map(([key,val,cls])=>(
                          <td key={key as string} className="px-3 py-3 text-center">
                            {editingPayroll
                              ? <input type="number" step="0.5" defaultValue={val as number}
                                  onChange={e=>setPayrollDraft(d=>({...d,[p.id]:{...d[p.id],[key]:Number(e.target.value)}}))}
                                  className={`w-12 text-center border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-300 ${cls}`}/>
                              : <span className={`font-bold ${cls}`}>{(val as number)>0?val:'—'}</span>}
                          </td>
                        ))}
                        {/* Tạm ứng */}
                        <td className="px-3 py-3 text-center">
                          {editingPayroll
                            ? <input type="number" defaultValue={adv}
                                onChange={e=>setPayrollDraft(d=>({...d,[p.id]:{...d[p.id],advances:Number(e.target.value)}}))}
                                className="w-16 text-center border border-rose-200 rounded px-1 py-0.5 text-rose-600 focus:outline-none"/>
                            : <span className={adv>0?'text-rose-600 font-bold':'text-slate-400'}>{adv>0?`−${adv}`:'—'}</span>}
                        </td>
                        {/* Thực nhận */}
                        <td className="px-3 py-3 text-right">
                          <p className="font-bold text-blue-700">{net.toLocaleString()}</p>
                          {(otWd+otWe+otHol)>0 && <p className="text-[9px] text-orange-500">OT: +{Math.round(otPay).toLocaleString()}K</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50/60 border-t border-blue-100">
                    <td colSpan={6} className="px-4 py-2.5 text-xs font-bold text-blue-800">TỔNG LƯƠNG CÁN BỘ</td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold text-blue-800">
                      {activePeople.filter(p=>p.type==='staff').reduce((sum,p)=>{
                        const att=attendance.filter(a=>a.personId===p.id);
                        const base=payrollDraft[p.id]?.daysWorked??(att.reduce((s,a)=>s+(a.status==='present'?1:a.status==='half'?0.5:0),0)||23);
                        const otWd=payrollDraft[p.id]?.otWeekday??0;
                        const otWe=payrollDraft[p.id]?.otWeekend??0;
                        const otHol=payrollDraft[p.id]?.otHoliday??0;
                        const adv=payrollDraft[p.id]?.advances??0;
                        const hrRate=p.salaryBase/stdDays/hoursPerDay;
                        const otPay=otWd*hrRate*rateWd+otWe*hrRate*rateWe+otHol*hrRate*rateHol;
                        return sum+Math.round((p.salaryBase/stdDays)*base+otPay+p.allowance-p.salaryBase*0.105-adv);
                      },0).toLocaleString()}K
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ══ BẢNG CÔNG NHÂN (lương ngày) ══ */}
          <div className="bg-white border border-amber-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2">
              <HardHat size={13} className="text-amber-600"/>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Công nhân NTP — Lương ngày</p>
              <span className="ml-auto text-[10px] text-amber-500">
                Chu kỳ: {cfg?.workerPayCycle==='week'?'Hàng tuần':cfg?.workerPayCycle==='biweek'?'2 tuần':'Hàng tháng'}
                {' · '}Công thức: Lương ngày × Ngày công + OT + Phụ cấp − Tạm ứng
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Công nhân</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ngày công</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">OT thường (h)</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">OT CN (h)</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">OT lễ (h)</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tạm ứng (K)</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Thực nhận (K)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activePeople.filter(p=>p.type==='worker').map(p=>{
                    const att   = attendance.filter(a=>a.personId===p.id);
                    const daysFromAtt = att.reduce((s,a)=>s+(a.status==='present'?1:a.status==='half'?0.5:0),0);
                    const base  = payrollDraft[p.id]?.daysWorked ?? (daysFromAtt||22);
                    const otWd  = payrollDraft[p.id]?.otWeekday  ?? att.filter(a=>a.otType==='weekday').reduce((s,a)=>s+a.otHours,0);
                    const otWe  = payrollDraft[p.id]?.otWeekend  ?? att.filter(a=>a.otType==='weekend').reduce((s,a)=>s+a.otHours,0);
                    const otHol = payrollDraft[p.id]?.otHoliday  ?? att.filter(a=>a.otType==='holiday').reduce((s,a)=>s+a.otHours,0);
                    const adv   = payrollDraft[p.id]?.advances   ?? 0;
                    // CN: salaryBase = K/ngày
                    const hrRate = p.salaryBase / hoursPerDay;
                    const otPay  = otWd*hrRate*rateWd + otWe*hrRate*rateWe + otHol*hrRate*rateHol;
                    const net    = Math.round(p.salaryBase*base + otPay + p.allowance - adv);
                    return (
                      <tr key={p.id} className="hover:bg-amber-50/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {p.name.split(' ').slice(-1)[0].slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{p.name}</p>
                              <p className="text-[10px] text-slate-400">{p.team} · {p.contractor} · {p.salaryBase.toLocaleString()}K/ngày</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {editingPayroll
                            ? <input type="number" step="0.5" defaultValue={base}
                                onChange={e=>setPayrollDraft(d=>({...d,[p.id]:{...d[p.id],daysWorked:Number(e.target.value)}}))}
                                className="w-14 text-center border border-amber-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400"/>
                            : <span className="font-bold text-slate-700">{base}</span>}
                        </td>
                        {[['otWeekday',otWd,'text-orange-500'],['otWeekend',otWe,'text-amber-500'],['otHoliday',otHol,'text-rose-500']].map(([key,val,cls])=>(
                          <td key={key as string} className="px-3 py-3 text-center">
                            {editingPayroll
                              ? <input type="number" step="0.5" defaultValue={val as number}
                                  onChange={e=>setPayrollDraft(d=>({...d,[p.id]:{...d[p.id],[key]:Number(e.target.value)}}))}
                                  className={`w-12 text-center border border-slate-200 rounded px-1 py-0.5 focus:outline-none ${cls}`}/>
                              : <span className={`font-bold ${cls}`}>{(val as number)>0?val:'—'}</span>}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-center">
                          {editingPayroll
                            ? <input type="number" defaultValue={adv}
                                onChange={e=>setPayrollDraft(d=>({...d,[p.id]:{...d[p.id],advances:Number(e.target.value)}}))}
                                className="w-16 text-center border border-rose-200 rounded px-1 py-0.5 text-rose-600 focus:outline-none"/>
                            : <span className={adv>0?'text-rose-600 font-bold':'text-slate-400'}>{adv>0?`−${adv}`:'—'}</span>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-bold text-amber-700">{net.toLocaleString()}</p>
                          {(otWd+otWe+otHol)>0 && <p className="text-[9px] text-orange-500">OT: +{Math.round(otPay).toLocaleString()}K</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-50/60 border-t border-amber-100">
                    <td colSpan={6} className="px-4 py-2.5 text-xs font-bold text-amber-800">TỔNG LƯƠNG CÔNG NHÂN</td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold text-amber-800">
                      {activePeople.filter(p=>p.type==='worker').reduce((sum,p)=>{
                        const att=attendance.filter(a=>a.personId===p.id);
                        const base=payrollDraft[p.id]?.daysWorked??(att.reduce((s,a)=>s+(a.status==='present'?1:a.status==='half'?0.5:0),0)||22);
                        const otWd=payrollDraft[p.id]?.otWeekday??0;
                        const otWe=payrollDraft[p.id]?.otWeekend??0;
                        const otHol=payrollDraft[p.id]?.otHoliday??0;
                        const adv=payrollDraft[p.id]?.advances??0;
                        const hrRate=p.salaryBase/hoursPerDay;
                        return sum+Math.round(p.salaryBase*base+(otWd*hrRate*rateWd+otWe*hrRate*rateWe+otHol*hrRate*rateHol)+p.allowance-adv);
                      },0).toLocaleString()}K
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tổng hợp + Actions */}
          <div className="bg-slate-800 rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-slate-400 font-medium">TỔNG QUỸ LƯƠNG THÁNG {currentMonth}</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {(
                  activePeople.reduce((sum,p)=>{
                    const att=attendance.filter(a=>a.personId===p.id);
                    const base=payrollDraft[p.id]?.daysWorked??(att.reduce((s,a)=>s+(a.status==='present'?1:a.status==='half'?0.5:0),0)||(p.type==='staff'?23:22));
                    const otWd=payrollDraft[p.id]?.otWeekday??att.filter(a=>a.otType==='weekday').reduce((s,a)=>s+a.otHours,0);
                    const otWe=payrollDraft[p.id]?.otWeekend??att.filter(a=>a.otType==='weekend').reduce((s,a)=>s+a.otHours,0);
                    const otHol=payrollDraft[p.id]?.otHoliday??att.filter(a=>a.otType==='holiday').reduce((s,a)=>s+a.otHours,0);
                    const adv=payrollDraft[p.id]?.advances??0;
                    if(p.type==='staff'){
                      const hr=p.salaryBase/stdDays/hoursPerDay;
                      return sum+Math.round((p.salaryBase/stdDays)*base+(otWd*hr*rateWd+otWe*hr*rateWe+otHol*hr*rateHol)+p.allowance-p.salaryBase*0.105-adv);
                    } else {
                      const hr=p.salaryBase/hoursPerDay;
                      return sum+Math.round(p.salaryBase*base+(otWd*hr*rateWd+otWe*hr*rateWe+otHol*hr*rateHol)+p.allowance-adv);
                    }
                  },0)/1000
                ).toFixed(1)}M đ
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={()=>setPrintMp({type:'payroll', projectName, period:currentMonth,
                payrollRows:activePeople.map(p=>{
                  const att=attendance.filter(a=>a.personId===p.id);
                  const base=payrollDraft[p.id]?.daysWorked??(att.reduce((s,a)=>s+(a.status==='present'?1:a.status==='half'?0.5:0),0)||(p.type==='staff'?23:22));
                  const otWd=payrollDraft[p.id]?.otWeekday??0;
                  const otWe=payrollDraft[p.id]?.otWeekend??0;
                  const otHol=payrollDraft[p.id]?.otHoliday??0;
                  const adv=payrollDraft[p.id]?.advances??0;
                  const hrRate=p.type==='staff'?p.salaryBase/stdDays/hoursPerDay:p.salaryBase/hoursPerDay;
                  const basePay=p.type==='staff'?(p.salaryBase/stdDays)*base:p.salaryBase*base;
                  const otPay=otWd*hrRate*rateWd+otWe*hrRate*rateWe+otHol*hrRate*rateHol;
                  const deductions=p.type==='staff'?Math.round(p.salaryBase*0.105)+adv:adv;
                  const net=Math.round(basePay+otPay+p.allowance-deductions);
                  return {name:p.name,role:p.jobTitle,baseSalary:Math.round(basePay),otPay:Math.round(otPay),deductions,net};
                })
              })}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors">
                <Printer size={13}/> In bảng lương
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors">
                <FileSpreadsheet size={13}/> Xuất Excel
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors">
                <UploadCloud size={13}/> Import Excel
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/80 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors">
                <Zap size={13}/> GEM quét bảng công
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ══ VIEW: LỊCH 3 CA ══ */}
      {view==='shift' && <ShiftScheduleView people={activePeople} projectName={projectName} pid={pid}/>}

                  {/* ── DRAWER ── */}
      {selectedPerson && (
        <PersonDrawer
          person={selectedPerson}
          onClose={()=>setSelectedPerson(null)}
          onSave={savePerson}
          attendance={attendance}
        />
      )}

      {/* ── APPROVAL ── */}
      {showApproval && (
        <ApprovalQueue
          projectId={pid}
          projectName={projectName}
          ctx={currentCtx}
          onClose={()=>setShowApproval(false)}
        />
      )}

      {/* ── PRINT ── */}
      {printMp && <ManpowerPrint data={printMp} onClose={()=>setPrintMp(null)}/>}
    </div>
  );
}
