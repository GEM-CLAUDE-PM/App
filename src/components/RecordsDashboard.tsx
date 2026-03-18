import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import { useNotification } from './NotificationEngine';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Folder, FileText, Files, CheckCircle2, Clock, AlertTriangle, UploadCloud,
  Loader2, Plus, Eye, Download, Trash2, Sparkles, Search, HardDrive,
  Cloud, ExternalLink, HardHat, X, Save, Send, ChevronDown, ChevronRight,
  ArrowRight, Check, AlertCircle, RefreshCw, GitBranch, MessageSquare,
  FileSpreadsheet, Info, Calendar, User, Hash, Tag, Filter, History,
  Layers, Edit3, Bell, Copy, ClipboardList
} from 'lucide-react';
import { createDocument, submitDocument, getApprovalQueue, type ApprovalDoc } from './approvalEngine';
import { WORKFLOWS, type UserContext } from './permissions';
import { getCurrentCtx } from './projectMember';
import ApprovalQueue from './ApprovalQueue';

import type { DashboardProps } from './types';

type Props = DashboardProps & {
  isConnectedOneDrive?:    boolean;
  isConnectedGoogleDrive?: boolean;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type DrawingStatus = 'current' | 'superseded' | 'draft' | 'cancelled';
type RFIStatus     = 'draft' | 'open' | 'answered' | 'closed' | 'overdue';
type RFIPriority   = 'low' | 'normal' | 'urgent';

interface DrawingRevision {
  id: string;
  drawing_no: string;
  title: string;
  discipline: string;   // Kiến trúc / Kết cấu / MEP / Hạ tầng
  current_rev: string;  // A, B, C, 0, 1, 2...
  revisions: {
    rev: string;
    date: string;
    author: string;
    description: string;
    file: string;
    status: DrawingStatus;
  }[];
  rfi_linked: string[]; // RFI IDs
  note?: string;
}

interface RFIItem {
  id: string;
  rfi_no: string;
  title: string;
  discipline: string;
  status: RFIStatus;
  priority: RFIPriority;
  date_issued: string;
  date_required: string;
  date_answered?: string;
  submitted_by: string;
  assigned_to: string;
  description: string;
  drawing_ref?: string;
  note?: string;
  response?: string;
  attachments: number;
  linked_ncr?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_DRAWINGS: DrawingRevision[] = [
  {
    id:'D001', drawing_no:'A-001', title:'Mặt bằng tầng 1 — Block A', discipline:'Kiến trúc', current_rev:'C',
    rfi_linked:['RFI-003'],
    revisions:[
      { rev:'A', date:'15/09/2025', author:'KTS Minh Tuấn', description:'Phát hành lần đầu', file:'A-001_RevA.pdf', status:'superseded' },
      { rev:'B', date:'10/11/2025', author:'KTS Minh Tuấn', description:'Điều chỉnh vị trí cầu thang bộ theo yêu cầu PCCC', file:'A-001_RevB.pdf', status:'superseded' },
      { rev:'C', date:'18/01/2026', author:'KTS Minh Tuấn', description:'Cập nhật kích thước sảnh tầng 1 — xem VO-001', file:'A-001_RevC.pdf', status:'current' },
    ],
  },
  {
    id:'D002', drawing_no:'KC-015', title:'Chi tiết cốt thép móng băng trục A-B', discipline:'Kết cấu', current_rev:'B',
    rfi_linked:['RFI-001'],
    revisions:[
      { rev:'0', date:'20/09/2025', author:'KSC Hùng', description:'Bản phát hành thi công', file:'KC-015_Rev0.pdf', status:'superseded' },
      { rev:'A', date:'05/12/2025', author:'KSC Hùng', description:'Sửa đổi chi tiết nối cốt thép theo RFI-001', file:'KC-015_RevA.pdf', status:'superseded' },
      { rev:'B', date:'25/01/2026', author:'KSC Hùng', description:'Cập nhật chiều dày bê tông lót 100mm → 150mm', file:'KC-015_RevB.pdf', status:'current' },
    ],
  },
  {
    id:'D003', drawing_no:'M-008', title:'Sơ đồ hệ thống cấp nước tầng hầm B1-B2', discipline:'MEP', current_rev:'A',
    rfi_linked:['RFI-002'],
    revisions:[
      { rev:'0', date:'01/10/2025', author:'KS Phúc', description:'Phát hành lần đầu', file:'M-008_Rev0.pdf', status:'superseded' },
      { rev:'A', date:'14/02/2026', author:'KS Phúc', description:'Điều chỉnh tuyến ống chính D150 — tránh xung đột kết cấu', file:'M-008_RevA.pdf', status:'current' },
    ],
    note:'Đang chờ phản hồi RFI-002 về vị trí van xả',
  },
  {
    id:'D004', drawing_no:'A-045', title:'Mặt đứng chính Block B — hướng Nam', discipline:'Kiến trúc', current_rev:'D',
    rfi_linked:[],
    note:'⚠️ Một số NTP đang dùng Rev B — cần thông báo cập nhật Rev D',
    revisions:[
      { rev:'A', date:'10/09/2025', author:'KTS Lan Anh', description:'Phát hành', file:'A-045_RevA.pdf', status:'superseded' },
      { rev:'B', date:'15/10/2025', author:'KTS Lan Anh', description:'Cập nhật hệ lam che nắng', file:'A-045_RevB.pdf', status:'superseded' },
      { rev:'C', date:'20/12/2025', author:'KTS Lan Anh', description:'Thêm chi tiết kính mặt đứng theo VO-001', file:'A-045_RevC.pdf', status:'superseded' },
      { rev:'D', date:'05/02/2026', author:'KTS Lan Anh', description:'Hoàn thiện chi tiết joint kính + khung nhôm', file:'A-045_RevD.pdf', status:'current' },
    ],
  },
  {
    id:'D005', drawing_no:'E-022', title:'Sơ đồ nguyên lý tủ điện tầng 5', discipline:'MEP', current_rev:'0',
    rfi_linked:['RFI-004'],
    revisions:[
      { rev:'0', date:'12/01/2026', author:'KS Điện Đức', description:'Phát hành thi công', file:'E-022_Rev0.pdf', status:'draft' },
    ],
  },
];

const MOCK_RFIS: RFIItem[] = [
  {
    id:'rfi1', rfi_no:'RFI-001', title:'Làm rõ chi tiết nối cốt thép móng tại vị trí giao nhau trục A-3',
    discipline:'Kết cấu', status:'closed', priority:'urgent',
    date_issued:'01/12/2025', date_required:'08/12/2025', date_answered:'05/12/2025',
    submitted_by:'KS Giám sát Hoàng', assigned_to:'TVGS — Công ty TKS',
    description:'Bản vẽ KC-015 Rev0 không thể hiện rõ cách nối cốt thép D22 tại nút giao móng băng — móng đơn trục A-3. Đề nghị TVGS làm rõ hoặc cung cấp bản vẽ chi tiết.',
    drawing_ref:'KC-015', response:'Xem chi tiết bổ sung đính kèm. Nối chồng L=40d, đai tăng cường 3Ø8 mỗi nút.', attachments:2,
  },
  {
    id:'rfi2', rfi_no:'RFI-002', title:'Xác nhận cao độ đặt van xả đáy hệ thống cấp nước tầng hầm',
    discipline:'MEP', status:'open', priority:'normal',
    date_issued:'10/02/2026', date_required:'17/02/2026',
    submitted_by:'NTP Cơ điện Á Đông', assigned_to:'TVGS MEP — KS Minh',
    description:'Bản vẽ M-008 Rev0 chỉ ghi "đặt theo hiện trường" — không có cao độ cụ thể cho van xả đáy D80. Yêu cầu xác nhận cao độ +0.500 hay +0.300 so với sàn B1 để tránh xung đột với tuyến ống thoát nước.',
    drawing_ref:'M-008', attachments:1,
  },
  {
    id:'rfi3', rfi_no:'RFI-003', title:'Kích thước hành lang thoát nạn tầng 1 — chưa đủ 1.5m theo QCVN',
    discipline:'Kiến trúc', status:'answered', priority:'urgent',
    date_issued:'20/01/2026', date_required:'27/01/2026', date_answered:'25/01/2026',
    submitted_by:'KS Giám sát Hoàng', assigned_to:'TVGS — KTS Minh Tuấn',
    description:'Bản vẽ A-001 Rev B: Chiều rộng hành lang thoát nạn tại trục 3-4 đo được 1.35m, không đạt QCVN 06:2022/BXD yêu cầu tối thiểu 1.5m. Yêu cầu làm rõ hoặc điều chỉnh thiết kế.',
    drawing_ref:'A-001', response:'Đã điều chỉnh trong Rev C — hành lang mở rộng đạt 1.6m. Tham chiếu A-001_RevC.pdf đính kèm.', attachments:3, linked_ncr:'NCR-012',
  },
  {
    id:'rfi4', rfi_no:'RFI-004', title:'Xác nhận chủng loại MCB cho tủ điện tầng 5 — ABB hay Schneider',
    discipline:'MEP', status:'open', priority:'normal',
    date_issued:'25/02/2026', date_required:'04/03/2026',
    submitted_by:'NTP Cơ điện Á Đông', assigned_to:'TVGS MEP — KS Minh',
    description:'Bản vẽ E-022 Rev0 ghi "MCB 3P 63A — theo chỉ định CĐT" nhưng spec chưa xác định hãng. NTP cần xác nhận để đặt hàng sớm (thời gian giao hàng 4-6 tuần).',
    drawing_ref:'E-022', attachments:0,
  },
  {
    id:'rfi5', rfi_no:'RFI-005', title:'Yêu cầu bổ sung bản vẽ chi tiết gờ dầm tại tầng kỹ thuật',
    discipline:'Kết cấu', status:'overdue', priority:'urgent',
    date_issued:'15/02/2026', date_required:'22/02/2026',
    submitted_by:'KS Giám sát Hoàng', assigned_to:'TVGS — KSC Hùng',
    description:'Tầng kỹ thuật (tầng 7) có nhiều gờ dầm đặc biệt cho lắp đặt thiết bị nhưng chưa có bản vẽ chi tiết. Không thể thi công nếu thiếu bản vẽ này.',
    drawing_ref:'', attachments:0,
    note:'Đã gửi nhắc nhở 2 lần — quá hạn 13 ngày!',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DISC_CLS: Record<string, string> = {
  'Kiến trúc': 'bg-blue-100 text-blue-700',
  'Kết cấu':   'bg-amber-100 text-amber-700',
  'MEP':        'bg-purple-100 text-purple-700',
  'Hạ tầng':   'bg-emerald-100 text-emerald-700',
};

const REV_STATUS: Record<DrawingStatus, { label: string; cls: string }> = {
  current:    { label:'Hiện hành', cls:'bg-emerald-100 text-emerald-700' },
  superseded: { label:'Đã thay thế', cls:'bg-slate-100 text-slate-500' },
  draft:      { label:'Nháp', cls:'bg-amber-100 text-amber-700' },
  cancelled:  { label:'Huỷ', cls:'bg-rose-100 text-rose-600' },
};

const RFI_STATUS: Record<RFIStatus, { label: string; cls: string; dot: string }> = {
  draft:    { label:'Nháp',         cls:'bg-slate-100 text-slate-600',   dot:'bg-slate-400'   },
  open:     { label:'Đang mở',      cls:'bg-blue-100 text-blue-700',     dot:'bg-blue-500'    },
  answered: { label:'Đã trả lời',   cls:'bg-teal-100 text-teal-700',     dot:'bg-teal-500'    },
  closed:   { label:'Đã đóng',      cls:'bg-emerald-100 text-emerald-700',dot:'bg-emerald-500' },
  overdue:  { label:'Quá hạn',      cls:'bg-rose-100 text-rose-700',     dot:'bg-rose-500'    },
};

const RFI_PRIORITY: Record<RFIPriority, { label: string; cls: string }> = {
  low:    { label:'Thấp',   cls:'bg-slate-100 text-slate-500' },
  normal: { label:'Bình thường', cls:'bg-blue-50 text-blue-600' },
  urgent: { label:'Khẩn',  cls:'bg-rose-100 text-rose-700 font-bold' },
};

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300";

// ─── Tab: Hồ sơ tài liệu (original, preserved) ───────────────────────────────
function TabHoSo({ project, isConnectedOneDrive, isConnectedGoogleDrive }: Props) {
  const { ok: notifOk, info: notifInfo } = useNotification();
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [docCategory, setDocCategory] = useState('Tất cả');
  const [cloudSource, setCloudSource] = useState<'local'|'onedrive'|'gdrive'>('local');
  const drawingInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzingDrawing, setIsAnalyzingDrawing] = useState(false);
  const [analyzedDrawing, setAnalyzedDrawing] = useState<any | null>(null);

  const allDocs = [
    { id:1, name:'Giấy phép xây dựng.pdf', category:'Pháp lý', type:'pdf', size:'2.4 MB', date:'01/01/2026', status:'valid' },
    { id:2, name:'Quyết định phê duyệt.pdf', category:'Pháp lý', type:'pdf', size:'1.8 MB', date:'05/01/2026', status:'valid' },
    { id:3, name:'Hợp đồng thi công.pdf', category:'Pháp lý', type:'pdf', size:'5.2 MB', date:'10/01/2026', status:'valid' },
    { id:4, name:'Bảo lãnh thực hiện hợp đồng.pdf', category:'Pháp lý', type:'pdf', size:'0.9 MB', date:'12/01/2026', status:'expiring' },
    { id:5, name:'Ban_ve_kien_truc_A-001_RevC.pdf', category:'Bản vẽ', type:'pdf', size:'15.6 MB', date:'18/01/2026', status:'valid' },
    { id:6, name:'Ban_ve_ket_cau_KC-015_RevB.pdf', category:'Bản vẽ', type:'pdf', size:'8.3 MB', date:'25/01/2026', status:'valid' },
    { id:7, name:'Ban_ve_MEP_M-008_RevA.pdf', category:'Bản vẽ', type:'pdf', size:'12.1 MB', date:'14/02/2026', status:'valid' },
    { id:8, name:'Tieu_chuan_thi_cong.pdf', category:'Kỹ thuật', type:'pdf', size:'3.7 MB', date:'01/01/2026', status:'valid' },
    { id:9, name:'Bien_phap_thi_cong.doc', category:'Kỹ thuật', type:'doc', size:'2.1 MB', date:'05/01/2026', status:'valid' },
    { id:10, name:'Bang_tong_hop_KLHT_T2.xlsx', category:'Nghiệm thu', type:'xlsx', size:'1.4 MB', date:'01/03/2026', status:'pending' },
    { id:11, name:'BB_Nghiem_thu_mong.pdf', category:'Nghiệm thu', type:'pdf', size:'0.7 MB', date:'20/02/2026', status:'valid' },
    { id:12, name:'BB_Hop_giao_ban_Tuan_4.doc', category:'Biên bản', type:'doc', size:'0.5 MB', date:'28/02/2026', status:'valid' },
    { id:13, name:'BB_Xu_ly_ky_thuat_nut_dam.pdf', category:'Biên bản', type:'pdf', size:'1.2 MB', date:'25/02/2026', status:'valid' },
  ];
  const categories = ['Tất cả','Pháp lý','Bản vẽ','Kỹ thuật','Nghiệm thu','Biên bản'];
  const filtered = allDocs.filter(d => (docCategory==='Tất cả'||d.category===docCategory) && d.name.toLowerCase().includes(docSearchTerm.toLowerCase()));
  const typeColor: Record<string,string> = { pdf:'text-rose-500 bg-rose-50', dwg:'text-blue-500 bg-blue-50', doc:'text-blue-600 bg-blue-50', xlsx:'text-emerald-600 bg-emerald-50' };
  const statusBadge: Record<string,string> = { valid:'bg-emerald-100 text-emerald-700', pending:'bg-amber-100 text-amber-700', expiring:'bg-orange-100 text-orange-700' };
  const statusLabel: Record<string,string> = { valid:'Hợp lệ', pending:'Chờ duyệt', expiring:'Sắp hết hạn' };

  const handleDrawingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if(!file) return;
    setIsAnalyzingDrawing(true); setAnalyzedDrawing(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY });
        const r = await model.generateContent('Phân tích bản vẽ xây dựng. Trả JSON: { title, revision, scale, date, notes: string[], warnings: string[], summary, materials: [{name,spec,quantity}] }. Chỉ JSON thuần.');
        const text = r.response.text().replace(/```json|```/g,'').trim();
        try { setAnalyzedDrawing(JSON.parse(text)); }
        catch { setAnalyzedDrawing({ title:file.name, summary:r.response.text(), notes:[], warnings:[], materials:[] }); }
      } catch { setAnalyzedDrawing({ title:file.name, summary:'Không thể phân tích.', notes:[], warnings:[], materials:[] }); }
      setIsAnalyzingDrawing(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      {(!isConnectedOneDrive && !isConnectedGoogleDrive) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0"/>
          <p className="text-sm text-amber-700">Kết nối OneDrive hoặc Google Drive để truy cập hồ sơ cloud</p>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {label:'Tổng hồ sơ', val:allDocs.length, cls:'bg-blue-50 text-blue-600'},
          {label:'Hợp lệ', val:allDocs.filter(d=>d.status==='valid').length, cls:'bg-emerald-50 text-emerald-600'},
          {label:'Chờ duyệt', val:allDocs.filter(d=>d.status==='pending').length, cls:'bg-amber-50 text-amber-600'},
          {label:'Sắp hết hạn', val:allDocs.filter(d=>d.status==='expiring').length, cls:'bg-orange-50 text-orange-600'},
        ].map((s,i)=>(
          <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className={`p-2 rounded-xl w-fit mb-2 ${s.cls}`}><Files size={16}/></div>
            <div className="text-2xl font-bold text-slate-800">{s.val}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="text" placeholder="Tìm tài liệu..." value={docSearchTerm} onChange={e=>setDocSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map(c=>(
            <button key={c} onClick={()=>setDocCategory(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${docCategory===c?'bg-emerald-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c}</button>
          ))}
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button onClick={()=>isConnectedOneDrive&&setCloudSource('onedrive')} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${cloudSource==='onedrive'?'bg-white text-blue-600 shadow-sm':'text-slate-500'}`}><Cloud size={12}/>OneDrive</button>
            <button onClick={()=>isConnectedGoogleDrive&&setCloudSource('gdrive')} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${cloudSource==='gdrive'?'bg-white text-emerald-600 shadow-sm':'text-slate-500'}`}><HardDrive size={12}/>GDrive</button>
          </div>
          <button onClick={()=>notifInfo('Chức năng đang phát triển')} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700"><UploadCloud size={13}/>Tải lên</button>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Folder size={15} className={cloudSource==='onedrive'?'text-blue-500':'text-emerald-500'}/>
            <span className="text-slate-400">/</span><span>{project?.name||'Dự án'}</span>
            <span className="text-slate-400">/</span><span className="text-slate-800 font-semibold">{docCategory==='Tất cả'?'Tất cả tài liệu':docCategory}</span>
          </div>
          <button className="text-xs text-emerald-600 font-medium flex items-center gap-1">Mở trong {cloudSource==='onedrive'?'OneDrive':'GDrive'}<ExternalLink size={11}/></button>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.length===0?(<div className="py-12 text-center text-slate-400"><Files size={36} className="mx-auto mb-2 opacity-30"/><p className="font-medium text-sm">Không tìm thấy tài liệu</p></div>):
          filtered.map(doc=>(
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group">
              <div className={`p-2 rounded-lg shrink-0 ${typeColor[doc.type]||'text-slate-500 bg-slate-50'}`}>
                {doc.type==='xlsx'?<FileSpreadsheet size={15}/>:<FileText size={15}/>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{doc.size} · {doc.date}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-flex ${statusBadge[doc.status]}`}>{statusLabel[doc.status]}</span>
              <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full shrink-0 hidden md:inline-flex">{doc.category}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Eye size={13}/></button>
                <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Download size={13}/></button>
                <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">Hiển thị {filtered.length}/{allDocs.length} tài liệu</div>
      </div>

      {/* GEM Drawing Analyzer */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Sparkles size={20}/></div>
          <div>
            <h4 className="font-bold text-slate-800">Phân tích bản vẽ với Nàng GEM</h4>
            <p className="text-xs text-slate-500">Tải lên bản vẽ để bóc tách vật tư, kết cấu tự động</p>
          </div>
        </div>
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 cursor-pointer" onClick={()=>drawingInputRef.current?.click()}>
          <input type="file" ref={drawingInputRef} className="hidden" accept=".pdf,.dwg,.dxf" onChange={handleDrawingUpload}/>
          <UploadCloud size={40} className="mx-auto text-slate-400 mb-3"/>
          <p className="text-slate-600 font-medium text-sm">Kéo thả hoặc click để chọn bản vẽ</p>
          <p className="text-xs text-slate-400 mt-1">PDF, DWG, DXF · Tối đa 50MB</p>
        </div>
        {isAnalyzingDrawing && (
          <div className="mt-4 p-5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
            <Loader2 size={24} className="text-emerald-500 animate-spin shrink-0"/>
            <p className="text-emerald-700 font-medium text-sm">Nàng GEM đang phân tích bản vẽ...</p>
          </div>
        )}
        {analyzedDrawing && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-emerald-700 flex items-center gap-2"><CheckCircle2 size={16}/>Phân tích hoàn tất — {analyzedDrawing.title}</p>
              <button onClick={()=>setAnalyzedDrawing(null)} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold">Lưu vào dự án</button>
            </div>
            {analyzedDrawing.summary && <p className="text-xs text-emerald-800 whitespace-pre-wrap">{analyzedDrawing.summary}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Revision History ────────────────────────────────────────────────────
function TabRevision({ onTriggerApproval }: { onTriggerApproval?: (title: string) => void }) {
  const { ok: notifOk, info: notifInfo } = useNotification();
  const [drawings, setDrawings] = useState<DrawingRevision[]>(MOCK_DRAWINGS);
  const [filterDisc, setFilterDisc] = useState('Tất cả');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newRevForm, setNewRevForm] = useState({ drawingId:'', rev:'', description:'', author:'' });

  const disciplines = ['Tất cả','Kiến trúc','Kết cấu','MEP','Hạ tầng'];
  const filtered = drawings.filter(d =>
    (filterDisc==='Tất cả'||d.discipline===filterDisc) &&
    (d.drawing_no.toLowerCase().includes(search.toLowerCase())||d.title.toLowerCase().includes(search.toLowerCase()))
  );

  const outdatedWarnings = drawings.filter(d => d.note?.includes('⚠️'));
  const totalRevs = drawings.reduce((s,d)=>s+d.revisions.length,0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Tổng bản vẽ', val:drawings.length, cls:'bg-blue-100 text-blue-600' },
          { label:'Tổng revision', val:totalRevs, cls:'bg-slate-100 text-slate-600' },
          { label:'Đang dùng Rev lỗi thời', val:outdatedWarnings.length, cls:'bg-amber-100 text-amber-600' },
          { label:'Liên kết RFI', val:drawings.filter(d=>d.rfi_linked.length>0).length, cls:'bg-purple-100 text-purple-600' },
        ].map((k,i)=>(
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><GitBranch size={16}/></div>
            <div className="text-2xl font-bold text-slate-800">{k.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Outdated warning */}
      {outdatedWarnings.map(d=>(
        <div key={d.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <Bell size={16} className="text-amber-500 mt-0.5 shrink-0"/>
          <div className="flex-1">
            <p className="font-bold text-amber-800 text-sm">{d.drawing_no} — {d.title}</p>
            <p className="text-xs text-amber-600 mt-0.5">{d.note}</p>
          </div>
          <button onClick={()=>notifOk('Đã gửi thông báo cập nhật bản vẽ đến NTP!')} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 shrink-0">
            Thông báo NTP
          </button>
        </div>
      ))}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          {disciplines.map(d=>(
            <button key={d} onClick={()=>setFilterDisc(d)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filterDisc===d?'bg-emerald-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{d}</button>
          ))}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm bản vẽ..." className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 w-36"/>
          </div>
        </div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
          <Plus size={15}/> Thêm Revision
        </button>
      </div>

      {/* Drawing list */}
      <div className="space-y-3">
        {filtered.map(d=>{
          const isExpanded = expandedId===d.id;
          const currentRev = d.revisions.find(r=>r.status==='current');
          return (
            <div key={d.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50" onClick={()=>setExpandedId(isExpanded?null:d.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-slate-500"/>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-black text-slate-800 text-sm font-mono">{d.drawing_no}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DISC_CLS[d.discipline]||'bg-slate-100 text-slate-600'}`}>{d.discipline}</span>
                      {d.rfi_linked.length>0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1"><MessageSquare size={9}/>RFI: {d.rfi_linked.join(', ')}</span>}
                    </div>
                    <p className="text-sm text-slate-700 truncate">{d.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-slate-700">Rev <span className="text-emerald-600 text-base">{d.current_rev}</span></div>
                    <div className="text-[10px] text-slate-400">{currentRev?.date}</div>
                  </div>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg">{d.revisions.length} revs</span>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${isExpanded?'rotate-180':''}`}/>
                </div>
              </div>

              {/* Note warning */}
              {d.note && !isExpanded && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={11}/>{d.note}
                  </p>
                </div>
              )}

              {/* Expanded revision history */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {d.note && (
                    <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                      <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0"/>
                      <p className="text-xs text-amber-700">{d.note}</p>
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wide">Lịch sử revision</p>
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[18px] top-4 bottom-4 w-px bg-slate-200"></div>
                      <div className="space-y-3">
                        {[...d.revisions].reverse().map((r,i)=>{
                          const st = REV_STATUS[r.status];
                          const isCurrent = r.status==='current';
                          return (
                            <div key={r.rev} className="flex items-start gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 z-10 border-2 ${isCurrent?'bg-emerald-500 text-white border-emerald-500':'bg-white text-slate-500 border-slate-300'}`}>
                                {r.rev}
                              </div>
                              <div className={`flex-1 rounded-xl p-3 border ${isCurrent?'bg-emerald-50 border-emerald-200':'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                                    <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={10}/>{r.date}</span>
                                    <span className="text-xs text-slate-500 flex items-center gap-1"><User size={10}/>{r.author}</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Download size={12}/></button>
                                    <button className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Eye size={12}/></button>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-700">{r.description}</p>
                                <p className="text-[10px] text-slate-400 mt-1 font-mono">{r.file}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={()=>{setNewRevForm(p=>({...p,drawingId:d.id}));setShowForm(true);}} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">
                      <Plus size={12}/> Thêm revision mới
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add revision modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><GitBranch size={17} className="text-emerald-600"/>Thêm Revision mới</h3>
              <button onClick={()=>setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Bản vẽ</label>
                <select value={newRevForm.drawingId} onChange={e=>setNewRevForm(p=>({...p,drawingId:e.target.value}))} className={inputCls}>
                  <option value="">-- Chọn bản vẽ --</option>
                  {drawings.map(d=><option key={d.id} value={d.id}>{d.drawing_no} — {d.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Ký hiệu Revision</label>
                  <input placeholder="VD: D, 3, Rev4..." value={newRevForm.rev} onChange={e=>setNewRevForm(p=>({...p,rev:e.target.value}))} className={inputCls}/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Tác giả</label>
                  <input placeholder="KTS / KSC / KS..." value={newRevForm.author} onChange={e=>setNewRevForm(p=>({...p,author:e.target.value}))} className={inputCls}/>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Nội dung thay đổi</label>
                <textarea rows={3} placeholder="Mô tả chi tiết nội dung điều chỉnh trong revision này..." value={newRevForm.description} onChange={e=>setNewRevForm(p=>({...p,description:e.target.value}))} className={inputCls + " resize-none"}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">File bản vẽ (upload)</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50">
                  <UploadCloud size={20} className="mx-auto text-slate-400 mb-1"/>
                  <p className="text-xs text-slate-500">Click để chọn file PDF/DWG</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowForm(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold">Hủy</button>
              <button onClick={()=>{
                if(!newRevForm.drawingId||!newRevForm.rev) return notifInfo('Vui lòng chọn bản vẽ và nhập ký hiệu revision!');
                setDrawings(prev=>prev.map(d=>{
                  if(d.id!==newRevForm.drawingId) return d;
                  const updatedRevs = d.revisions.map(r=>({...r, status:'superseded' as DrawingStatus}));
                  return { ...d, current_rev:newRevForm.rev, revisions:[...updatedRevs,{rev:newRevForm.rev,date:new Date().toLocaleDateString('vi-VN'),author:newRevForm.author,description:newRevForm.description,file:`${d.drawing_no}_Rev${newRevForm.rev}.pdf`,status:'current' as DrawingStatus}] };
                }));
                setShowForm(false);
                notifInfo('Đã thêm revision mới!');
              }} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2">
                <Save size={14}/> Lưu Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: RFI Tracker ─────────────────────────────────────────────────────────
function TabRFI({ onTriggerApproval }: { onTriggerApproval?: (title: string) => void }) {
  const { ok: notifOk, info: notifInfo } = useNotification();
  const [rfis, setRfis] = useState<RFIItem[]>(MOCK_RFIS);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDisc, setFilterDisc] = useState('Tất cả');
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [gemLoading, setGemLoading] = useState(false);
  const [gemText, setGemText] = useState('');
  const [newRFI, setNewRFI] = useState({ rfi_no:'', title:'', discipline:'Kết cấu', priority:'normal' as RFIPriority, description:'', drawing_ref:'', submitted_by:'', assigned_to:'', date_required:'' });

  const overdue = rfis.filter(r=>r.status==='overdue');
  const open    = rfis.filter(r=>r.status==='open');

  const filtered = rfis.filter(r =>
    (filterStatus==='all'||r.status===filterStatus) &&
    (filterDisc==='Tất cả'||r.discipline===filterDisc)
  );

  const avgResponseDays = () => {
    const answered = rfis.filter(r=>r.date_answered);
    if(!answered.length) return '—';
    return (answered.reduce((s,r)=>{
      const d1 = new Date(r.date_issued.split('/').reverse().join('-'));
      const d2 = new Date(r.date_answered!.split('/').reverse().join('-'));
      return s + (d2.getTime()-d1.getTime())/(1000*60*60*24);
    },0)/answered.length).toFixed(1);
  };

  const analyzeWithGEM = async (rfi: RFIItem) => {
    setGemLoading(true); setGemText('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY });
      const r = await model.generateContent(`Phân tích RFI xây dựng sau:\nRFI: ${rfi.rfi_no} — ${rfi.title}\nChuyên ngành: ${rfi.discipline}\nMô tả: ${rfi.description}\nBản vẽ tham chiếu: ${rfi.drawing_ref||'Không có'}\n${rfi.response?'Phản hồi: '+rfi.response:''}\n\nHãy: (1) Đánh giá tính rõ ràng của câu hỏi, (2) Gợi ý nội dung trả lời nếu chưa có, (3) Các tiêu chuẩn/quy chuẩn liên quan, (4) Rủi ro nếu không xử lý kịp thời.`);
      setGemText(r.response.text());
    } catch { setGemText('❌ Không thể kết nối GEM. Vui lòng thử lại.'); }
    setGemLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Tổng RFI', val:rfis.length, cls:'bg-slate-100 text-slate-600' },
          { label:'Đang mở', val:open.length, cls:'bg-blue-100 text-blue-600' },
          { label:'Quá hạn', val:overdue.length, cls:'bg-rose-100 text-rose-600' },
          { label:'TG phản hồi TB', val:`${avgResponseDays()} ngày`, cls:'bg-amber-100 text-amber-600' },
        ].map((k,i)=>(
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><MessageSquare size={16}/></div>
            <div className="text-2xl font-bold text-slate-800">{k.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Overdue alerts */}
      {overdue.map(r=>(
        <div key={r.id} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0"/>
          <div className="flex-1">
            <p className="font-bold text-rose-800 text-sm">{r.rfi_no} — QUÁ HẠN</p>
            <p className="text-xs text-rose-600 mt-0.5">{r.title}</p>
            <p className="text-xs text-rose-400 mt-0.5">Hạn phản hồi: {r.date_required} · Assign: {r.assigned_to}</p>
            {r.note && <p className="text-xs text-rose-700 font-semibold mt-1">{r.note}</p>}
          </div>
          <button onClick={()=>notifOk('Đã gửi nhắc nhở!')} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 shrink-0">Nhắc nhở</button>
        </div>
      ))}

      {/* GEM panel */}
      {gemText && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-blue-800 text-sm flex items-center gap-2"><Sparkles size={15} className="text-blue-600"/>Nàng GEM — Phân tích RFI</span>
            <button onClick={()=>setGemText('')} className="p-1 hover:bg-blue-100 rounded-lg"><X size={14}/></button>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{gemText}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['all','open','answered','closed','overdue','draft'] as const).map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filterStatus===s?'bg-blue-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s==='all'?'Tất cả':RFI_STATUS[s].label}
              {s!=='all'&&<span className="ml-1 opacity-60">({rfis.filter(r=>r.status===s).length})</span>}
            </button>
          ))}
        </div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
          <Plus size={15}/> Tạo RFI
        </button>
      </div>

      {/* RFI List */}
      <div className="space-y-3">
        {filtered.length===0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-30"/>
            <p className="font-medium text-sm">Không có RFI nào</p>
          </div>
        )}
        {filtered.map(rfi=>{
          const st = RFI_STATUS[rfi.status];
          const pr = RFI_PRIORITY[rfi.priority];
          const isExpanded = expandedId===rfi.id;
          return (
            <div key={rfi.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${rfi.status==='overdue'?'border-rose-200':rfi.status==='open'?'border-blue-200':'border-slate-200'}`}>
              {/* Header */}
              <div className="p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50" onClick={()=>setExpandedId(isExpanded?null:rfi.id)}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rfi.status==='overdue'?'bg-rose-100':rfi.status==='open'?'bg-blue-100':rfi.status==='answered'?'bg-teal-100':'bg-emerald-100'}`}>
                    <MessageSquare size={17} className={rfi.status==='overdue'?'text-rose-600':rfi.status==='open'?'text-blue-600':'text-emerald-600'}/>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-black text-slate-800 text-sm">{rfi.rfi_no}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>{st.label}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${pr.cls}`}>{pr.label}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${DISC_CLS[rfi.discipline]||'bg-slate-100 text-slate-600'}`}>{rfi.discipline}</span>
                      {rfi.drawing_ref && <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-mono">{rfi.drawing_ref}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-700 truncate">{rfi.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{rfi.submitted_by} → {rfi.assigned_to}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-semibold text-slate-600">{rfi.date_issued}</div>
                    <div className={`text-[10px] ${rfi.status==='overdue'?'text-rose-600 font-bold':'text-slate-400'}`}>Hạn: {rfi.date_required}</div>
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${isExpanded?'rotate-180':''}`}/>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-4">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wide">Nội dung yêu cầu</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{rfi.description}</p>
                  </div>

                  {rfi.response ? (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-teal-600 uppercase mb-1.5 tracking-wide flex items-center gap-1"><Check size={10}/>Phản hồi từ {rfi.assigned_to}</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{rfi.response}</p>
                      {rfi.date_answered && <p className="text-[10px] text-teal-500 mt-1">Ngày trả lời: {rfi.date_answered}</p>}
                    </div>
                  ) : (
                    <div className="bg-white border border-dashed border-slate-300 rounded-xl p-3">
                      <p className="text-xs text-slate-400 text-center">Chưa có phản hồi</p>
                      <textarea rows={2} placeholder="Nhập nội dung phản hồi..." className="w-full mt-2 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"/>
                      <button onClick={()=>{setRfis(p=>p.map(r=>r.id===rfi.id?{...r,status:'answered' as RFIStatus,date_answered:new Date().toLocaleDateString('vi-VN'),response:'(Đã trả lời)'}:r));}} className="mt-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 flex items-center gap-1.5">
                        <Send size={11}/> Gửi phản hồi
                      </button>
                    </div>
                  )}

                  {rfi.linked_ncr && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                      <Tag size={13} className="text-amber-500"/>
                      <p className="text-xs text-amber-700">Liên kết NCR: <strong>{rfi.linked_ncr}</strong></p>
                    </div>
                  )}

                  {rfi.note && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                      <p className="text-xs text-rose-700 font-semibold">{rfi.note}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={()=>analyzeWithGEM(rfi)} disabled={gemLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50">
                      {gemLoading?<Loader2 size={12} className="animate-spin"/>:<Sparkles size={12}/>} GEM Phân tích
                    </button>
                    {rfi.status==='open'&&(
                      <button onClick={()=>setRfis(p=>p.map(r=>r.id===rfi.id?{...r,status:'answered' as RFIStatus}:r))} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold hover:bg-teal-100">
                        <Check size={11}/> Đánh dấu đã trả lời
                      </button>
                    )}
                    {rfi.status==='answered'&&(
                      <button onClick={()=>setRfis(p=>p.map(r=>r.id===rfi.id?{...r,status:'closed' as RFIStatus}:r))} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">
                        <CheckCircle2 size={11}/> Đóng RFI
                      </button>
                    )}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">
                      <Copy size={11}/> Sao chép link
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create RFI Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><MessageSquare size={17} className="text-blue-600"/>Tạo RFI mới</h3>
              <button onClick={()=>setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Số RFI</label>
                <input placeholder="VD: RFI-006" value={newRFI.rfi_no} onChange={e=>setNewRFI(p=>({...p,rfi_no:e.target.value}))} className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Mức ưu tiên</label>
                <select value={newRFI.priority} onChange={e=>setNewRFI(p=>({...p,priority:e.target.value as RFIPriority}))} className={inputCls}>
                  <option value="low">Thấp</option><option value="normal">Bình thường</option><option value="urgent">Khẩn</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Tiêu đề RFI</label>
                <input placeholder="Mô tả ngắn gọn yêu cầu làm rõ" value={newRFI.title} onChange={e=>setNewRFI(p=>({...p,title:e.target.value}))} className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Chuyên ngành</label>
                <select value={newRFI.discipline} onChange={e=>setNewRFI(p=>({...p,discipline:e.target.value}))} className={inputCls}>
                  {['Kiến trúc','Kết cấu','MEP','Hạ tầng','Khác'].map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Bản vẽ tham chiếu</label>
                <input placeholder="VD: KC-015, A-001..." value={newRFI.drawing_ref} onChange={e=>setNewRFI(p=>({...p,drawing_ref:e.target.value}))} className={inputCls}/>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Mô tả chi tiết yêu cầu</label>
                <textarea rows={4} placeholder="Mô tả rõ ràng vấn đề cần làm rõ, vị trí, hạng mục liên quan, tại sao cần làm rõ..." value={newRFI.description} onChange={e=>setNewRFI(p=>({...p,description:e.target.value}))} className={inputCls + " resize-none"}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Người gửi</label>
                <input placeholder="VD: KS Giám sát Hoàng" value={newRFI.submitted_by} onChange={e=>setNewRFI(p=>({...p,submitted_by:e.target.value}))} className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Assign cho</label>
                <input placeholder="VD: TVGS — KSC Hùng" value={newRFI.assigned_to} onChange={e=>setNewRFI(p=>({...p,assigned_to:e.target.value}))} className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Hạn phản hồi</label>
                <input placeholder="DD/MM/YYYY" value={newRFI.date_required} onChange={e=>setNewRFI(p=>({...p,date_required:e.target.value}))} className={inputCls}/>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowForm(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold">Hủy</button>
              <button onClick={()=>{
                if(!newRFI.rfi_no||!newRFI.title) return notifInfo('Vui lòng điền Số RFI và Tiêu đề!');
                const rfi: RFIItem = {
                  id:'rfi_'+Date.now(), rfi_no:newRFI.rfi_no, title:newRFI.title,
                  discipline:newRFI.discipline, status:'open', priority:newRFI.priority,
                  date_issued:new Date().toLocaleDateString('vi-VN'), date_required:newRFI.date_required,
                  submitted_by:newRFI.submitted_by, assigned_to:newRFI.assigned_to,
                  description:newRFI.description, drawing_ref:newRFI.drawing_ref, attachments:0,
                };
                setRfis(p=>[rfi,...p]);
                setNewRFI({ rfi_no:'', title:'', discipline:'Kết cấu', priority:'normal', description:'', drawing_ref:'', submitted_by:'', assigned_to:'', date_required:'' });
                setShowForm(false);
                notifOk('Đã tạo RFI mới!');
              }} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
                <Save size={14}/> Tạo RFI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RecordsDashboard({ project: selectedProject, isConnectedOneDrive, isConnectedGoogleDrive }: Props) {
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [mainTab, setMainTab] = useState<'docs'|'revision'|'rfi'>('docs');
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);

  const pid = selectedProject?.id || 'p1';
  const ctx: UserContext = getCurrentCtx(pid);

  const [rdQueue, setRdQueue] = useState<ApprovalDoc[]>(() => getApprovalQueue(pid, ctx));
  const refreshRdQueue = useCallback(() => setRdQueue(getApprovalQueue(pid, ctx)), [pid]);
  useEffect(() => { refreshRdQueue(); }, [refreshRdQueue]);

  const triggerRdDoc = useCallback((title: string, docType: any, data = {}) => {
    if (!WORKFLOWS[docType as keyof typeof WORKFLOWS]) return;
    const cr = createDocument({ projectId: pid, docType, ctx, title, data });
    if (!cr.ok) { notifErr(`❌ ${(cr as any).error}`); return; }
    const sr = submitDocument(pid, (cr as any).data!.id, ctx);
    if (sr.ok) refreshRdQueue();
    else notifErr(`❌ ${(sr as any).error}`);
  }, [pid, ctx, refreshRdQueue]);

  const tabs = [
    { id:'docs' as const,     label:'Hồ sơ tài liệu',   icon:<Files size={14}/>       },
    { id:'revision' as const, label:'Revision History',  icon:<GitBranch size={14}/>   },
    { id:'rfi' as const,      label:'RFI Tracker',       icon:<MessageSquare size={14}/> },
  ];

  return (
    <div className="space-y-5">
      {/* Tab nav + approval badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setMainTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${mainTab===t.id?'bg-white shadow-sm text-emerald-700':'text-slate-500 hover:text-slate-700'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowApprovalPanel(true)}
          className="relative flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-semibold text-slate-600 shadow-sm transition-all">
          <ClipboardList size={13}/> Hàng duyệt HK
          {rdQueue.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
              {rdQueue.length}
            </span>
          )}
        </button>
      </div>

      {mainTab==='docs'     && <TabHoSo project={selectedProject} projectId={pid} isConnectedOneDrive={isConnectedOneDrive} isConnectedGoogleDrive={isConnectedGoogleDrive}/>}
      {mainTab==='revision' && <TabRevision onTriggerApproval={(title: string) => triggerRdDoc(title, 'DRAWING_REVISION')} />}
      {mainTab==='rfi'      && <TabRFI onTriggerApproval={(title: string) => triggerRdDoc(title, 'RFI')} />}

      {/* Approval Queue Drawer */}
      {showApprovalPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowApprovalPanel(false)}/>
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            <ApprovalQueue
              projectId={pid}
              projectName={selectedProject?.name || 'Dự án'}
              ctx={ctx}
              onClose={() => { setShowApprovalPanel(false); refreshRdQueue(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
