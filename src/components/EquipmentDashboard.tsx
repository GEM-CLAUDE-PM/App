import { useNotification } from './NotificationEngine';
import React, { useState, useRef, useMemo } from 'react';
import { Truck, Wrench, Fuel, Activity, AlertTriangle, Plus, X, Save, Clock,
  CheckCircle2, CircleDashed, AlertCircle, Sparkles,
  TrendingUp, TrendingDown, BarChart2, Calendar, User, Eye,
  DollarSign, Shield, Gauge, Info, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { createDocument, submitDocument, getApprovalQueue, type ApprovalDoc } from './approvalEngine';
import { WORKFLOWS, type UserContext } from './permissions';
import { getCurrentMember, buildCtxFromMember } from './projectMember';
import ApprovalQueue from './ApprovalQueue';
import { ClipboardList } from 'lucide-react';
import { db, useRealtimeSync } from './db';
import type { DashboardProps } from './types';

type Props = DashboardProps & { readOnly?: boolean };

// ─── Mock Data ───────────────────────────────────────────────────────────────
const EQUIPMENT_LIST = [
  { id:'EQ001', name:'Máy xúc lật Komatsu WA380', type:'Máy xúc', owner:'NTP', status:'active', location:'Khu vực móng', operator:'Nguyễn Văn A', fuel:'diesel', fuelRate:15, nextMaint:'15/03/2026', oee:85, hours:1240 },
  { id:'EQ002', name:'Cẩu tháp Liebherr 180EC', type:'Cẩu tháp', owner:'thuê', status:'active', location:'Block B', operator:'Trần Văn B', fuel:'electric', fuelRate:0, nextMaint:'20/03/2026', oee:92, hours:980 },
  { id:'EQ003', name:'Máy ủi Caterpillar D6', type:'Máy ủi', owner:'thuê', status:'maintenance', location:'Xưởng bảo trì', operator:'—', fuel:'diesel', fuelRate:22, nextMaint:'01/06/2026', oee:40, hours:2100 },
  { id:'EQ004', name:'Máy lu rung Sakai SW850', type:'Máy lu', owner:'NTP', status:'idle', location:'Bãi tập kết', operator:'—', fuel:'diesel', fuelRate:12, nextMaint:'10/04/2026', oee:95, hours:560 },
  { id:'EQ005', name:'Máy bơm bê tông Putzmeister', type:'Máy bơm', owner:'thuê', status:'active', location:'Block A', operator:'Lê Văn C', fuel:'diesel', fuelRate:20, nextMaint:'02/03/2026', oee:70, hours:890 },
  { id:'EQ006', name:'Máy đào Komatsu PC200', type:'Máy đào', owner:'thuê', status:'active', location:'Tầng hầm B1', operator:'Phạm Văn D', fuel:'diesel', fuelRate:18, nextMaint:'18/04/2026', oee:88, hours:1450 },
];

const EQUIPMENT_LOGS = [
  { id:'LOG001', equipId:'EQ001', date:'06/03/2026', shift:'Ca sáng', startTime:'07:00', endTime:'12:00', hours:5, task:'Đào móng block A tầng B2', volume:'120 m³', operator:'Nguyễn Văn A', note:'', confirmed:true },
  { id:'LOG002', equipId:'EQ002', date:'06/03/2026', shift:'Cả ngày', startTime:'07:00', endTime:'17:00', hours:10, task:'Cẩu cốt thép tầng 5 block B', volume:'45 tấn', operator:'Trần Văn B', note:'', confirmed:true },
  { id:'LOG003', equipId:'EQ005', date:'06/03/2026', shift:'Ca chiều', startTime:'13:00', endTime:'18:00', hours:5, task:'Bơm bê tông sàn tầng 3', volume:'80 m³', operator:'Lê Văn C', note:'Dừng 30 phút do mưa', confirmed:false },
  { id:'LOG004', equipId:'EQ006', date:'05/03/2026', shift:'Ca sáng', startTime:'06:30', endTime:'12:00', hours:5.5, task:'Đào tầng hầm B1 ô lưới C3-D4', volume:'95 m³', operator:'Phạm Văn D', note:'', confirmed:true },
  { id:'LOG005', equipId:'EQ001', date:'05/03/2026', shift:'Cả ngày', startTime:'07:00', endTime:'17:30', hours:10.5, task:'San lấp khu vực sân vườn A', volume:'200 m³', operator:'Nguyễn Văn A', note:'', confirmed:true },
];

const MAINTENANCE_ITEMS = [
  { id:'MT001', equipId:'EQ005', type:'Khẩn cấp', desc:'Kiểm tra bơm thủy lực — sắp hết giờ bảo dưỡng', scheduledDate:'02/03/2026', status:'overdue', cost:0, provider:'', technician:'' },
  { id:'MT002', equipId:'EQ001', type:'Định kỳ', desc:'Thay dầu máy + lọc dầu, kiểm tra hệ thống phanh', scheduledDate:'15/03/2026', status:'scheduled', cost:0, provider:'Đại lý Komatsu HCM', technician:'KTV Minh' },
  { id:'MT003', equipId:'EQ003', type:'Sửa chữa', desc:'Sửa hệ thống thủy lực — rò rỉ dầu cylinder trái', scheduledDate:'01/03/2026', status:'in_progress', cost:12500000, provider:'CAT Service', technician:'KTV Đức' },
  { id:'MT004', equipId:'EQ002', type:'Định kỳ', desc:'Kiểm tra cáp cẩu + hệ thống phanh điện từ', scheduledDate:'20/03/2026', status:'scheduled', cost:0, provider:'Liebherr Vietnam', technician:'' },
  { id:'MT005', equipId:'EQ006', type:'Định kỳ', desc:'Thay dầu máy, kiểm tra xích máy đào', scheduledDate:'18/04/2026', status:'scheduled', cost:0, provider:'Đại lý Komatsu HCM', technician:'' },
];

const FUEL_LOGS = [
  { id:'FL001', equipId:'EQ001', date:'06/03/2026', liters:75, unitPrice:22500, total:1687500, station:'Petrolimex CT', baseline:15, actual:15, note:'' },
  { id:'FL002', equipId:'EQ006', date:'06/03/2026', liters:90, unitPrice:22500, total:2025000, station:'Petrolimex CT', baseline:18, actual:16.4, note:'Tiết kiệm hơn định mức' },
  { id:'FL003', equipId:'EQ005', date:'05/03/2026', liters:100, unitPrice:22500, total:2250000, station:'Shell CT', baseline:20, actual:20, note:'' },
  { id:'FL004', equipId:'EQ001', date:'04/03/2026', liters:157, unitPrice:22500, total:3532500, station:'Petrolimex CT', baseline:15, actual:14.9, note:'' },
  { id:'FL005', equipId:'EQ003', date:'28/02/2026', liters:44, unitPrice:22000, total:968000, station:'Petrolimex CT', baseline:22, actual:28, note:'Bất thường — kiểm tra lại' },
];

const INCIDENTS = [
  { id:'INC001', equipId:'EQ005', date:'01/03/2026', type:'Hỏng hóc', severity:'medium', desc:'Bơm thủy lực rò rỉ — giảm áp suất', downtime:8, repairCost:8500000, status:'resolved', rootCause:'Seal cũ — chưa bảo dưỡng đúng hạn', preventive:'Bổ sung hạng mục kiểm tra seal vào checklist định kỳ' },
  { id:'INC002', equipId:'EQ003', date:'28/02/2026', type:'Hỏng hóc', severity:'high', desc:'Cylinder thủy lực trái bị rò rỉ dầu nghiêm trọng', downtime:72, repairCost:12500000, status:'in_progress', rootCause:'Quá tải liên tục không đúng spec', preventive:'Giới hạn tải trọng + lắp cảm biến tải' },
  { id:'INC003', equipId:'EQ002', date:'15/02/2026', type:'Dừng kỹ thuật', severity:'low', desc:'Cúp điện khu vực — cẩu ngừng hoạt động', downtime:3, repairCost:0, status:'resolved', rootCause:'Mất điện lưới', preventive:'Lắp UPS cho hệ thống điều khiển' },
];

const fuelTrendData = [
  { month:'T1', eq001:280, eq006:340, eq005:380 },
  { month:'T2', eq001:310, eq006:295, eq005:400 },
  { month:'T3', eq001:232, eq006:270, eq005:200 },
];

const oeeTrendData = [
  { week:'W1/2', eq001:82, eq002:95, eq005:65 },
  { week:'W2/2', eq001:88, eq002:91, eq005:72 },
  { week:'W1/3', eq001:85, eq002:92, eq005:70 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const statusBadge: Record<string, { label: string; cls: string; dot: string }> = {
  active:      { label:'Đang hoạt động', cls:'bg-emerald-100 text-emerald-700', dot:'bg-emerald-500' },
  maintenance: { label:'Đang bảo dưỡng', cls:'bg-amber-100 text-amber-700', dot:'bg-amber-500' },
  idle:        { label:'Rảnh rỗi', cls:'bg-rose-100 text-rose-700', dot:'bg-rose-400' },
};
const maintStatusMap: Record<string, { label: string; cls: string }> = {
  scheduled:   { label:'Lên lịch', cls:'bg-blue-100 text-blue-700' },
  in_progress: { label:'Đang thực hiện', cls:'bg-amber-100 text-amber-700' },
  overdue:     { label:'Quá hạn', cls:'bg-rose-100 text-rose-700' },
  done:        { label:'Hoàn thành', cls:'bg-emerald-100 text-emerald-700' },
};
const incidentSeverity: Record<string, { label: string; cls: string }> = {
  low:    { label:'Nhẹ', cls:'bg-slate-100 text-slate-600' },
  medium: { label:'Trung bình', cls:'bg-amber-100 text-amber-700' },
  high:   { label:'Nghiêm trọng', cls:'bg-rose-100 text-rose-700' },
};
const fmt = (n: number) => n.toLocaleString('vi-VN');
const eq = (id: string) => EQUIPMENT_LIST.find(e => e.id === id);

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, icon, onClose, children, readOnly = false }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; readOnly?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">

      {/* ReadOnly Banner */}
      {readOnly && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 print:hidden">
          <Eye size={14} className="text-amber-500 shrink-0"/>
          <p className="text-xs font-semibold text-amber-700">
            Chế độ xem — Vai trò của bạn không có quyền thao tác trên module này
          </p>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">{icon}{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300";

// ─── Sub-tab: Danh sách ───────────────────────────────────────────────────────
function TabDanhSach({ onSelectEquip }: { onSelectEquip: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const filtered = EQUIPMENT_LIST.filter(e => (filter === 'all' || e.status === filter) && (e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Tổng thiết bị', val: EQUIPMENT_LIST.length, cls:'bg-slate-100 text-slate-600', badge:'Tổng' },
          { label:'Đang hoạt động', val: EQUIPMENT_LIST.filter(e=>e.status==='active').length, cls:'bg-emerald-100 text-emerald-600', badge:'75%' },
          { label:'Bảo dưỡng/Sửa chữa', val: EQUIPMENT_LIST.filter(e=>e.status==='maintenance').length, cls:'bg-amber-100 text-amber-600', badge:'⚠️' },
          { label:'Rảnh rỗi', val: EQUIPMENT_LIST.filter(e=>e.status==='idle').length, cls:'bg-rose-100 text-rose-600', badge:'Điều phối' },
        ].map((k,i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${k.cls}`}><Truck size={20}/></div>
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{k.badge}</span>
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">{k.val}</div>
            <div className="text-sm text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* GEM insight */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0"><Sparkles size={20} className="text-emerald-100"/></div>
          <div>
            <p className="font-bold mb-2">Nàng GEM — Phân tích thiết bị</p>
            <div className="space-y-1.5 text-sm text-emerald-50">
              <p className="flex items-center gap-2"><AlertCircle size={14} className="text-amber-300 shrink-0"/><strong className="text-white">Cảnh báo:</strong> EQ004 rảnh rỗi 3 ngày — đề xuất điều chuyển hoặc trả hàng thuê.</p>
              <p className="flex items-center gap-2"><Wrench size={14} className="text-blue-200 shrink-0"/><strong className="text-white">Bảo dưỡng:</strong> EQ005 quá hạn bảo dưỡng 5 ngày — nguy cơ hỏng hóc cao.</p>
              <p className="flex items-center gap-2"><TrendingUp size={14} className="text-emerald-200 shrink-0"/><strong className="text-white">OEE tốt:</strong> EQ002 đạt 92% — vượt mục tiêu 85%.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Truck size={16} className="text-emerald-600"/> Danh sách thiết bị thi công</h3>
          <div className="flex gap-2 flex-wrap">
            {(['all','active','maintenance','idle'] as const).map(f => (
              <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${filter===f?'bg-emerald-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f==='all'?'Tất cả':f==='active'?'Hoạt động':f==='maintenance'?'Bảo dưỡng':'Rảnh rỗi'}
              </button>
            ))}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm..." className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 w-36"/>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Mã / Tên</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Vị trí · Lái máy</th>
                <th className="px-4 py-3 text-center">OEE</th>
                <th className="px-4 py-3 text-left">Bảo dưỡng tiếp</th>
                <th className="px-4 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(e => {
                const s = statusBadge[e.status];
                const isOverdue = e.status === 'active' && e.nextMaint && new Date(e.nextMaint.split('/').reverse().join('-')) < new Date();
                return (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-700 text-xs">{e.id}</div>
                      <div className="text-xs text-slate-600">{e.name}</div>
                      <div className="text-[10px] text-slate-400">{e.type} · {e.owner==='NTP'?'Chủ sở hữu':'Thuê'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>{s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{e.location}<br/><span className="text-slate-400">{e.operator}</span></td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${e.oee>=85?'text-emerald-600':e.oee>=70?'text-amber-600':'text-rose-600'}`}>{e.oee}%</span>
                      <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-auto mt-1">
                        <div className={`h-full rounded-full ${e.oee>=85?'bg-emerald-500':e.oee>=70?'bg-amber-500':'bg-rose-500'}`} style={{width:`${e.oee}%`}}></div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-xs ${isOverdue?'text-rose-600 font-semibold':'text-slate-600'}`}>
                      {isOverdue && <AlertCircle size={11} className="inline mr-1"/>}{e.nextMaint}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={()=>onSelectEquip(e.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Eye size={14}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* OEE chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Gauge size={15} className="text-emerald-600"/> OEE theo tuần</h4>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={oeeTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="week" tick={{fontSize:11}}/>
            <YAxis domain={[50,100]} tick={{fontSize:11}} unit="%"/>
            <Tooltip formatter={(v:any)=>`${v}%`}/>
            <Line type="monotone" dataKey="eq001" stroke="#10b981" name="EQ001" strokeWidth={2} dot={{r:3}}/>
            <Line type="monotone" dataKey="eq002" stroke="#0ea5e9" name="EQ002" strokeWidth={2} dot={{r:3}}/>
            <Line type="monotone" dataKey="eq005" stroke="#f59e0b" name="EQ005" strokeWidth={2} dot={{r:3}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Sub-tab: Nhật ký ca ──────────────────────────────────────────────────────
function TabNhatKy({ readOnly = false }: { readOnly?: boolean }) {
  const { ok: notifOk } = useNotification();
  const [showForm, setShowForm] = useState(false);
  const [filterEquip, setFilterEquip] = useState('all');
  const logs = EQUIPMENT_LOGS.filter(l => filterEquip==='all' || l.equipId===filterEquip);
  const totalH = logs.reduce((s,l)=>s+l.hours,0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">Tổng <strong className="text-slate-700">{logs.length}</strong> ca · <strong className="text-emerald-600">{totalH}h</strong> giờ máy · <strong className="text-emerald-600">{logs.filter(l=>l.confirmed).length}</strong> đã xác nhận</p>
        <button disabled={readOnly} onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
          <Plus size={15}/> Thêm nhật ký ca
        </button>
      </div>
      <select value={filterEquip} onChange={e=>setFilterEquip(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300">
        <option value="all">Tất cả thiết bị</option>
        {EQUIPMENT_LIST.map(e=><option key={e.id} value={e.id}>{e.id} — {e.name.slice(0,30)}</option>)}
      </select>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left">Ngày / Ca</th>
              <th className="px-4 py-3 text-left">Thiết bị</th>
              <th className="px-4 py-3 text-left">Hạng mục thi công</th>
              <th className="px-4 py-3 text-center">Giờ máy</th>
              <th className="px-4 py-3 text-left">KL thực hiện</th>
              <th className="px-4 py-3 text-center">Xác nhận</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map(l => {
              const e = eq(l.equipId);
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800 text-xs">{l.date}</div>
                    <div className="text-[11px] text-slate-500">{l.shift} · {l.startTime}–{l.endTime}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-slate-700">{l.equipId}</div>
                    <div className="text-[10px] text-slate-400">{e?.name.slice(0,22)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 max-w-xs">
                    <p className="truncate">{l.task}</p>
                    {l.note && <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1"><Info size={9}/>{l.note}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
                      <Clock size={10}/>{l.hours}h
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{l.volume}</td>
                  <td className="px-4 py-3 text-center">
                    {l.confirmed
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle2 size={12}/> Đã KT</span>
                      : <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-semibold"><Clock size={12}/> Chờ</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Thêm nhật ký ca máy" icon={<Clock size={17} className="text-emerald-600"/>} onClose={()=>setShowForm(false)} readOnly={readOnly}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><FormField label="Thiết bị">
              <select className={inputCls}>{EQUIPMENT_LIST.filter(e=>e.status==='active').map(e=><option key={e.id}>{e.id} — {e.name}</option>)}</select>
            </FormField></div>
            <FormField label="Người vận hành"><input placeholder="Họ tên lái máy / vận hành" className={inputCls}/></FormField>
            <FormField label="Ngày"><input placeholder="DD/MM/YYYY" className={inputCls}/></FormField>
            <FormField label="Ca làm việc">
              <select className={inputCls}><option>Ca sáng</option><option>Ca chiều</option><option>Cả ngày</option><option>Ca đêm</option></select>
            </FormField>
            <FormField label="Giờ bắt đầu"><input type="time" defaultValue="07:00" className={inputCls}/></FormField>
            <FormField label="Giờ kết thúc"><input type="time" defaultValue="12:00" className={inputCls}/></FormField>
            <FormField label="Số giờ máy tích lũy (h)"><input placeholder="VD: 1245" className={inputCls}/></FormField>
            <div className="col-span-2"><FormField label="Hạng mục thi công"><input placeholder="VD: Đào móng block A, bơm bê tông sàn tầng 3..." className={inputCls}/></FormField></div>
            <FormField label="Khối lượng thực hiện"><input placeholder="VD: 120 m³, 45 tấn" className={inputCls}/></FormField>
            <FormField label="Ghi chú sự cố / thời tiết"><input placeholder="Dừng máy, thời tiết bất thường..." className={inputCls}/></FormField>
          </div>
          <div className="flex gap-3 mt-6">
            <button disabled={readOnly} onClick={()=>setShowForm(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">Hủy</button>
            <button disabled={readOnly} onClick={()=>{notifOk('Đã lưu nhật ký ca!');setShowForm(false);}} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2">
              <Save size={14}/> Lưu nhật ký
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-tab: Bảo dưỡng ──────────────────────────────────────────────────────
function TabBaoDuong({ readOnly = false, onTriggerApproval, pendingCount = 0, maintItems, setMaintItems, pid }: {
  readOnly?: boolean;
  onTriggerApproval?: (title: string) => void;
  pendingCount?: number;
  maintItems: typeof MAINTENANCE_ITEMS;
  setMaintItems: React.Dispatch<React.SetStateAction<typeof MAINTENANCE_ITEMS>>;
  pid: string;
}) {
  const { ok: notifOk, info: notifInfo } = useNotification();
  const [showForm, setShowForm] = useState(false);
  const overdue = maintItems.filter(m=>m.status==='overdue');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3 flex-wrap">
          {overdue.length > 0 && <span className="flex items-center gap-1.5 text-sm font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200"><AlertTriangle size={13}/> {overdue.length} Quá hạn</span>}
          <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200"><Wrench size={13}/> {maintItems.filter(m=>m.status==='in_progress').length} Đang thực hiện</span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200"><Calendar size={13}/> {maintItems.filter(m=>m.status==='scheduled').length} Lên lịch</span>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={readOnly} onClick={() => {
            onTriggerApproval?.(`Yêu cầu mua sắm / bảo dưỡng thiết bị`);
            notifOk('Yêu cầu mua sắm thiết bị đã gửi duyệt!');
          }} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
            Gửi duyệt mua sắm {pendingCount > 0 && <span className="bg-white/30 px-1.5 rounded-full text-xs">{pendingCount}</span>}
          </button>
          <button disabled={readOnly} onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
            <Plus size={15}/> Lập lịch bảo dưỡng
          </button>
        </div>
      </div>

      {overdue.map(m => (
        <div key={m.id} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-rose-100 rounded-full flex items-center justify-center shrink-0"><AlertTriangle size={17} className="text-rose-600"/></div>
          <div className="flex-1">
            <p className="font-bold text-rose-700 text-sm">{eq(m.equipId)?.name} — BẢO DƯỠNG QUÁ HẠN</p>
            <p className="text-xs text-rose-600 mt-0.5">{m.desc}</p>
            <p className="text-xs text-rose-400 mt-1">Đã quá ngày {m.scheduledDate}</p>
          </div>
          <button onClick={() => {
              setMaintItems(prev => {
              const next = prev.map(x => x.id === m.id ? {...x, status: 'in_progress'} : x);
              db.set('eq_maintenance', pid, next);
              return next;
            });
              notifOk('Đã bắt đầu xử lý bảo dưỡng quá hạn!');
            }} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700">Xử lý ngay</button>
        </div>
      ))}

      <div className="space-y-3">
        {maintItems.map(m => {
          const st = maintStatusMap[m.status];
          return (
            <div key={m.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${m.status==='overdue'?'border-rose-200':m.status==='in_progress'?'border-amber-200':'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${m.type==='Sửa chữa'?'bg-rose-100 text-rose-600':m.type==='Khẩn cấp'?'bg-amber-100 text-amber-600':'bg-blue-100 text-blue-600'}`}>
                    <Wrench size={15}/>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-slate-800 text-sm">{eq(m.equipId)?.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{m.type}</span>
                    </div>
                    <p className="text-xs text-slate-600">{m.desc}</p>
                    <div className="flex gap-4 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1"><Calendar size={10}/> {m.scheduledDate}</span>
                      {m.provider && <span className="flex items-center gap-1"><User size={10}/> {m.provider}</span>}
                      {m.technician && <span className="flex items-center gap-1"><Shield size={10}/> {m.technician}</span>}
                      {m.cost > 0 && <span className="flex items-center gap-1 text-emerald-600 font-semibold"><DollarSign size={10}/> {fmt(m.cost)}đ</span>}
                    </div>
                  </div>
                </div>
                {m.status !== 'done' && (
                  <button onClick={() => {
                      if (m.status === 'in_progress') {
                        setMaintItems(prev => {
                          const next = prev.map(x => x.id === m.id ? {...x, status: 'done'} : x);
                          db.set('eq_maintenance', pid, next);
                          return next;
                        });
                        notifOk('Đã hoàn thành bảo dưỡng!');
                      } else {
                        setMaintItems(prev => {
                          const next = prev.map(x => x.id === m.id ? {...x, status: 'in_progress'} : x);
                          db.set('eq_maintenance', pid, next);
                          return next;
                        });
                        notifInfo('Đã bắt đầu bảo dưỡng!');
                      }
                    }} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 shrink-0">
                    {m.status==='in_progress'?'Hoàn thành':'Bắt đầu'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <Modal title="Lập lịch bảo dưỡng" icon={<Wrench size={17} className="text-emerald-600"/>} onClose={()=>setShowForm(false)} readOnly={readOnly}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><FormField label="Thiết bị"><select className={inputCls}>{EQUIPMENT_LIST.map(e=><option key={e.id}>{e.id} — {e.name}</option>)}</select></FormField></div>
            <FormField label="Loại bảo dưỡng"><select className={inputCls}>{['Định kỳ','Sửa chữa','Khẩn cấp','Kiểm tra'].map(t=><option key={t}>{t}</option>)}</select></FormField>
            <FormField label="Ngày lên lịch"><input placeholder="DD/MM/YYYY" className={inputCls}/></FormField>
            <div className="col-span-2"><FormField label="Mô tả công việc"><textarea rows={2} placeholder="VD: Thay dầu máy, kiểm tra hệ thống phanh..." className={inputCls + " resize-none"}/></FormField></div>
            <FormField label="Kỹ thuật viên thực hiện"><input placeholder="Họ tên KTV" className={inputCls}/></FormField>
            <FormField label="Nhà cung cấp dịch vụ"><input placeholder="Tên đại lý / công ty" className={inputCls}/></FormField>
            <FormField label="Chi phí dự kiến (đ)"><input placeholder="0" className={inputCls}/></FormField>
            <FormField label="Số giờ máy tại thời điểm BD"><input placeholder="VD: 1240h" className={inputCls}/></FormField>
          </div>
          <div className="flex gap-3 mt-6">
            <button disabled={readOnly} onClick={()=>setShowForm(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold">Hủy</button>
            <button disabled={readOnly} onClick={()=>{notifInfo('Đã lập lịch bảo dưỡng!');setShowForm(false);}} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2">
              <Save size={14}/> Lưu lịch
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-tab: Nhiên liệu ──────────────────────────────────────────────────────
function TabNhienLieu({ readOnly = false }: { readOnly?: boolean }) {
  const { ok: notifOk } = useNotification();
  const [showForm, setShowForm] = useState(false);
  const totalL = FUEL_LOGS.reduce((s,f)=>s+f.liters,0);
  const totalC = FUEL_LOGS.reduce((s,f)=>s+f.total,0);
  const abnormal = FUEL_LOGS.filter(f => f.actual > f.baseline * 1.1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Tổng tiêu thụ (tháng)', val:`${totalL.toLocaleString()} lít`, icon:<Fuel size={18}/>, cls:'bg-blue-100 text-blue-600' },
          { label:'Chi phí nhiên liệu', val:`${fmt(totalC)}đ`, icon:<DollarSign size={18}/>, cls:'bg-emerald-100 text-emerald-600' },
          { label:'Đơn giá bình quân', val:'22.400đ/lít', icon:<TrendingUp size={18}/>, cls:'bg-amber-100 text-amber-600' },
          { label:'Bất thường phát hiện', val:`${abnormal.length} TH`, icon:<AlertTriangle size={18}/>, cls:'bg-rose-100 text-rose-600' },
        ].map((k,i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}>{k.icon}</div>
            <div className="text-lg font-bold text-slate-800 mb-1">{k.val}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Fuel size={15} className="text-emerald-600"/> Nhật ký đổ dầu</h3>
        <button disabled={readOnly} onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
          <Plus size={15}/> Nhập phiếu dầu
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left">Ngày</th>
              <th className="px-4 py-3 text-left">Thiết bị</th>
              <th className="px-4 py-3 text-right">Số lít</th>
              <th className="px-4 py-3 text-right">Thành tiền</th>
              <th className="px-4 py-3 text-center">TT vs ĐM</th>
              <th className="px-4 py-3 text-left">Trạm · Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {FUEL_LOGS.map(f => {
              const isOver = f.actual > f.baseline * 1.1;
              return (
                <tr key={f.id} className={`hover:bg-slate-50 transition-colors ${isOver?'bg-rose-50/50':''}`}>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{f.date}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-slate-700">{f.equipId}</div>
                    <div className="text-[10px] text-slate-400">{eq(f.equipId)?.name.slice(0,22)}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">{f.liters} lít</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">{fmt(f.total)}đ</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-bold flex items-center justify-center gap-1 ${isOver?'text-rose-600':f.actual<f.baseline*0.95?'text-emerald-600':'text-slate-600'}`}>
                      {f.actual}L/h {isOver?<TrendingUp size={10}/>:f.actual<f.baseline*0.95?<TrendingDown size={10}/>:null}
                    </span>
                    <span className="text-[10px] text-slate-400">ĐM: {f.baseline}L/h</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {f.station}
                    {f.note && <p className="text-amber-600 text-[10px] mt-0.5">{f.note}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart2 size={15} className="text-emerald-600"/> Tiêu thụ nhiên liệu theo tháng (lít)</h4>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={fuelTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} unit="L"/>
            <Tooltip formatter={(v:any)=>`${v}L`}/>
            <Bar dataKey="eq001" fill="#10b981" name="EQ001" radius={[4,4,0,0]}/>
            <Bar dataKey="eq006" fill="#0ea5e9" name="EQ006" radius={[4,4,0,0]}/>
            <Bar dataKey="eq005" fill="#f59e0b" name="EQ005" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showForm && (
        <Modal title="Nhập phiếu đổ dầu" icon={<Fuel size={17} className="text-emerald-600"/>} onClose={()=>setShowForm(false)} readOnly={readOnly}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><FormField label="Thiết bị"><select className={inputCls}>{EQUIPMENT_LIST.filter(e=>e.fuel==='diesel').map(e=><option key={e.id}>{e.id} — {e.name}</option>)}</select></FormField></div>
            <FormField label="Ngày đổ dầu"><input placeholder="DD/MM/YYYY" className={inputCls}/></FormField>
            <FormField label="Số lít"><input placeholder="VD: 75" className={inputCls}/></FormField>
            <FormField label="Đơn giá (đ/lít)"><input placeholder="22500" defaultValue="22500" className={inputCls}/></FormField>
            <FormField label="Trạm xăng"><input placeholder="Petrolimex / Shell..." className={inputCls}/></FormField>
            <div className="col-span-2"><FormField label="Ghi chú"><input placeholder="Ghi chú bất thường nếu có..." className={inputCls}/></FormField></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button disabled={readOnly} onClick={()=>setShowForm(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold">Hủy</button>
            <button disabled={readOnly} onClick={()=>{notifOk('Đã lưu phiếu đổ dầu!');setShowForm(false);}} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2">
              <Save size={14}/> Lưu phiếu
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-tab: Sự cố ───────────────────────────────────────────────────────────
function TabSuCo({ readOnly = false }: { readOnly?: boolean }) {
  const { info: notifInfo } = useNotification();
  const [showForm, setShowForm] = useState(false);
  const totalDT = INCIDENTS.reduce((s,i)=>s+i.downtime,0);
  const totalC = INCIDENTS.reduce((s,i)=>s+i.repairCost,0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Sự cố tháng này', val: INCIDENTS.length, cls:'bg-rose-100 text-rose-600' },
          { label:'Tổng giờ dừng máy', val:`${totalDT}h`, cls:'bg-amber-100 text-amber-600' },
          { label:'Chi phí sửa chữa', val:`${fmt(totalC)}đ`, cls:'bg-slate-100 text-slate-600' },
          { label:'Đã giải quyết', val:`${INCIDENTS.filter(i=>i.status==='resolved').length}/${INCIDENTS.length}`, cls:'bg-emerald-100 text-emerald-600' },
        ].map((k,i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><AlertTriangle size={17}/></div>
            <div className="text-xl font-bold text-slate-800 mb-1">{k.val}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><AlertCircle size={15} className="text-rose-500"/> Danh sách sự cố</h3>
        <button disabled={readOnly} onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700">
          <Plus size={15}/> Báo cáo sự cố
        </button>
      </div>

      <div className="space-y-3">
        {INCIDENTS.map(inc => {
          const sv = incidentSeverity[inc.severity];
          return (
            <div key={inc.id} className={`bg-white border rounded-2xl p-5 shadow-sm ${inc.severity==='high'?'border-rose-200':inc.severity==='medium'?'border-amber-200':'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-slate-800">{eq(inc.equipId)?.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sv.cls}`}>{sv.label}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{inc.type}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${inc.status==='resolved'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>
                      {inc.status==='resolved'?'Đã giải quyết':'Đang xử lý'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{inc.desc}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{inc.date}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wide">Thời gian dừng</p>
                  <p className="font-bold text-slate-700">{inc.downtime}h</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wide">Chi phí sửa chữa</p>
                  <p className="font-bold text-slate-700">{inc.repairCost>0?`${fmt(inc.repairCost)}đ`:'Không phát sinh'}</p>
                </div>
                {inc.rootCause && (
                  <div className="col-span-2 bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <p className="text-[10px] font-semibold text-amber-600 mb-1 uppercase tracking-wide">Nguyên nhân gốc</p>
                    <p className="text-slate-700">{inc.rootCause}</p>
                  </div>
                )}
                {inc.preventive && (
                  <div className="col-span-2 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <p className="text-[10px] font-semibold text-emerald-600 mb-1 uppercase tracking-wide">Biện pháp phòng ngừa</p>
                    <p className="text-slate-700">{inc.preventive}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

            {showForm && (
        <Modal title="Báo cáo sự cố thiết bị" icon={<AlertTriangle size={17} className="text-rose-500"/>} onClose={()=>setShowForm(false)} readOnly={readOnly}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><FormField label="Thiết bị gặp sự cố">
              <select className={inputCls}>{EQUIPMENT_LIST.map(e=><option key={e.id}>{e.id} — {e.name}</option>)}</select>
            </FormField></div>
            <FormField label="Người phát hiện / báo cáo"><input placeholder="Họ tên người phát hiện" className={inputCls}/></FormField>
            <FormField label="Ngày xảy ra"><input placeholder="DD/MM/YYYY" className={inputCls}/></FormField>
            <FormField label="Loại sự cố">
              <select className={inputCls}>{['Hỏng hóc','Tai nạn','Mất cắp','Dừng kỹ thuật','Hư hại'].map(t=><option key={t}>{t}</option>)}</select>
            </FormField>
            <FormField label="Mức độ nghiêm trọng">
              <select className={inputCls}><option value="low">Nhẹ</option><option value="medium">Trung bình</option><option value="high">Nghiêm trọng</option></select>
            </FormField>
            <FormField label="Thời gian dừng máy (h)"><input placeholder="VD: 8" className={inputCls}/></FormField>
            <FormField label="Thiệt hại ước tính (đ)"><input placeholder="VD: 8500000" className={inputCls}/></FormField>
            <div className="col-span-2"><FormField label="Mô tả chi tiết sự cố">
              <textarea rows={2} placeholder="Mô tả đầy đủ tình trạng sự cố..." className={inputCls + " resize-none"}/>
            </FormField></div>
            <div className="col-span-2"><FormField label="Nguyên nhân ban đầu">
              <input placeholder="Nguyên nhân sơ bộ theo đánh giá tại hiện trường" className={inputCls}/>
            </FormField></div>
            <div className="col-span-2"><FormField label="Biện pháp xử lý đề xuất">
              <input placeholder="Biện pháp khắc phục tạm thời / dài hạn" className={inputCls}/>
            </FormField></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button disabled={readOnly} onClick={()=>setShowForm(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold">Hủy</button>
            <button disabled={readOnly} onClick={()=>{notifInfo('Đã ghi nhận sự cố!');setShowForm(false);}} className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 flex items-center justify-center gap-2">
              <Save size={14}/> Lưu báo cáo
            </button>
          </div>
        </Modal>
      )}    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function EquipmentDashboard({ project: selectedProject, readOnly = false }: Props) {
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [subTab, setSubTab] = useState<'list'|'logs'|'maintenance'|'fuel'|'incidents'|'oee'|'qr'>('list');

  const pid  = selectedProject?.id ?? 'p1';
  const currentMember = getCurrentMember(pid);
  const ctx: UserContext = useMemo(() => buildCtxFromMember(currentMember), [currentMember]);
  const dbLoaded = useRef(false);

  // ── maintItems — lifted from TabBaoDuong → persisted via db.ts ───────────
  const [maintItems, setMaintItems] = useState(MAINTENANCE_ITEMS);

  React.useEffect(() => {
    dbLoaded.current = false;
    db.get<typeof MAINTENANCE_ITEMS>('eq_maintenance', pid, MAINTENANCE_ITEMS)
      .then(data => { setMaintItems(data); })
      .catch(e => { console.warn('[EquipmentDashboard] load error:', e); })
      .finally(() => { dbLoaded.current = true; });
  }, [pid]);

  useRealtimeSync(pid, ['eq_maintenance'], async () => {
    const data = await db.get<typeof MAINTENANCE_ITEMS>('eq_maintenance', pid, MAINTENANCE_ITEMS);
    setMaintItems(data);
  });

  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [eqApprovalQueue, setEqApprovalQueue] = useState<ApprovalDoc[]>(() => getApprovalQueue(pid, ctx));

  const refreshEqQueue = React.useCallback(() => {
    setEqApprovalQueue(getApprovalQueue(pid, ctx));
  }, [pid]);

  const triggerEqDoc = React.useCallback((title: string, data: Record<string, unknown> = {}) => {
    const docType = 'PROCUREMENT';
    if (!WORKFLOWS[docType]) return;
    const cr = createDocument({ projectId: pid, docType, ctx, title, data });
    if (!cr.ok) { notifErr(`❌ ${(cr as any).error}`); return; }
    const sr = submitDocument(pid, cr.data!.id, ctx);
    if (sr.ok) {
      refreshEqQueue();
      const el = document.createElement('div');
      el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-700 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-2xl';
      el.textContent = '✅ PROCUREMENT "' + title + '" đã nộp duyệt';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    } else {
      notifErr(`❌ ${(sr as any).error}`);
    }
  }, [pid, refreshEqQueue]);

  const tabs = [
    { id:'list' as const, label:'Danh sách', icon:<Truck size={14}/> },
    { id:'logs' as const, label:'Nhật ký ca', icon:<Clock size={14}/> },
    { id:'maintenance' as const, label:'Bảo dưỡng', icon:<Wrench size={14}/> },
    { id:'fuel' as const, label:'Nhiên liệu', icon:<Fuel size={14}/> },
    { id:'incidents' as const, label:'Sự cố', icon:<AlertTriangle size={14}/> },
    { id:'oee'        as const, label:'OEE Chi tiết', icon:<Gauge size={14}/> },
    { id:'qr'         as const, label:'QR Code', icon:<Scan size={14}/> },
  ];

  const active = EQUIPMENT_LIST.filter(e=>e.status==='active').length;
  const maint = EQUIPMENT_LIST.filter(e=>e.status==='maintenance').length;
  const idle = EQUIPMENT_LIST.filter(e=>e.status==='idle').length;
  const overdueCount = MAINTENANCE_ITEMS.filter(m=>m.status==='overdue').length;

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl"><Activity size={12}/> {active} hoạt động</span>
        <span className="flex items-center gap-1.5 text-sm text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl"><Wrench size={12}/> {maint} bảo dưỡng</span>
        <span className="flex items-center gap-1.5 text-sm text-rose-600 font-semibold bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl"><CircleDashed size={12}/> {idle} rảnh rỗi</span>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-rose-700 font-bold bg-rose-100 border border-rose-300 px-3 py-1.5 rounded-xl animate-pulse">
            <AlertTriangle size={12}/> {overdueCount} bảo dưỡng QUÁ HẠN!
          </span>
        )}
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit flex-wrap items-center">
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${subTab===t.id?'bg-white shadow-sm text-emerald-700':'text-slate-500 hover:text-slate-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => setShowApprovalPanel(true)}
          className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all ml-2">
          <ClipboardList size={13}/> Hàng duyệt TB
          {eqApprovalQueue.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {eqApprovalQueue.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {subTab === 'list'        && <TabDanhSach onSelectEquip={()=>setSubTab('logs')}/>}
      {subTab === 'logs'        && <TabNhatKy readOnly={readOnly}/>}
      {subTab === 'maintenance' && <TabBaoDuong readOnly={readOnly} onTriggerApproval={(title) => triggerEqDoc(title)} pendingCount={eqApprovalQueue.length} maintItems={maintItems} setMaintItems={setMaintItems} pid={pid}/>}
      {subTab === 'fuel'        && <TabNhienLieu readOnly={readOnly}/>}
      {subTab === 'incidents'   && <TabSuCo readOnly={readOnly}/>}
      {subTab === 'oee' && (
        <div className="space-y-4">
          <p className="text-sm font-black text-slate-700">OEE Chi tiết — Overall Equipment Effectiveness</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EQUIPMENT_LIST.map(eq => {
              const avail = eq.status === 'active' ? 90 : eq.status === 'idle' ? 60 : 30;
              const perf  = Math.round(eq.oee / avail * 100 * 0.95);
              const qual  = Math.round(eq.oee / (avail * perf / 100));
              return (
                <div key={eq.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{eq.name}</p>
                      <p className="text-[10px] text-slate-400">{eq.id} · {eq.type}</p>
                    </div>
                    <span className={`text-lg font-black ${eq.oee>=85?'text-emerald-600':eq.oee>=70?'text-amber-600':'text-red-600'}`}>{eq.oee}%</span>
                  </div>
                  {[['Availability (Sẵn sàng)', avail, 'bg-blue-500'],['Performance (Hiệu suất)', Math.min(perf,100), 'bg-amber-500'],['Quality (Chất lượng)', Math.min(qual,100), 'bg-emerald-500']].map(([lbl,val,cls])=>(
                    <div key={lbl as string}>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>{lbl as string}</span><span className="font-bold">{val as number}%</span></div>
                      <div className="h-2 bg-slate-100 rounded-full"><div className={`h-full rounded-full ${cls}`} style={{width:`${val}%`}}/></div>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400">{eq.hours.toLocaleString()} giờ hoạt động · Bảo dưỡng tiếp: {eq.nextMaint}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {subTab === 'qr' && (
        <div className="space-y-4">
          <p className="text-sm font-black text-slate-700">QR Code thiết bị — quét để xem thông tin & nhật ký</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {EQUIPMENT_LIST.map(eq => {
              const qrData = `GEMPM:EQ:${eq.id}:${encodeURIComponent(eq.name)}`;
              const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
              return (
                <div key={eq.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-3">
                  <img src={qrUrl} alt={`QR ${eq.id}`} className="w-24 h-24 rounded-lg border border-slate-100"
                       loading="lazy" onError={e => { (e.target as HTMLImageElement).src = '/icons/icon-96.png'; }}/>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-800 line-clamp-1">{eq.name}</p>
                    <p className="text-[10px] text-slate-400">{eq.id}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      eq.status==='active'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'
                    }`}>{eq.status==='active'?'Hoạt động':'Bảo dưỡng'}</span>
                  </div>
                  <button onClick={() => { const a=document.createElement('a'); a.href=qrUrl; a.download=`QR_${eq.id}.png`; a.click(); }}
                    className="text-[10px] text-violet-600 hover:underline">Tải QR</button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400">QR dùng QRServer API — cần internet. Quét bằng điện thoại để điều hướng đến thiết bị trong app.</p>
        </div>
      )}
      {/* ── APPROVAL QUEUE DRAWER ── */}
      {showApprovalPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowApprovalPanel(false)}/>
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            <ApprovalQueue
              projectId={pid}
              projectName={selectedProject?.name || 'Dự án'}
              ctx={ctx}
              onClose={() => { setShowApprovalPanel(false); refreshEqQueue(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}