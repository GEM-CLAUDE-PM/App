import { useNotification } from './NotificationEngine';
import React, { useState, useCallback, useEffect } from 'react';
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import {
  Mail, Calendar, CheckSquare, FileText, Plus, X, Save, Send,
  Search, ChevronDown, Sparkles, Loader2, AlertTriangle, Check,
  CheckCircle2, Clock, User, Building2, Tag, Paperclip, Printer,
  Download, Edit3, Trash2, ArrowRight, ArrowLeft, Filter,
  BookOpen, Hash, Bell, Eye, Copy, MessageSquare, Flag,
  ChevronRight, Archive, Inbox, UploadCloud, ClipboardList
} from 'lucide-react';
import { createDocument, submitDocument, getApprovalQueue, getAllDocs, processApproval, getStatusConfig, getWorkflowProgress, getCurrentStepLabel } from './approvalEngine';
import type { ApprovalDoc } from './approvalEngine';
import { WORKFLOWS, type UserContext } from './permissions';
import { getCurrentMember, buildCtxFromMember } from './projectMember';
import ApprovalQueue from './ApprovalQueue';
import { db, useRealtimeSync } from './db';
import ModalForm, { FormRow, FormGrid, FormSection, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import type { DashboardProps } from './types';


type Props = DashboardProps;

// ─── Types ────────────────────────────────────────────────────────────────────
type CVStatus    = 'draft' | 'sent' | 'received' | 'processing' | 'closed';
type CVDir       = 'inbound' | 'outbound';
type MeetStatus  = 'scheduled' | 'in_progress' | 'done' | 'cancelled';
type ApprStatus  = 'draft' | 'pending' | 'approved' | 'rejected' | 'returned';
type MinuteStatus= 'draft' | 'confirmed';

interface CongVan {
  id: string; so_cv: string; trich_yeu: string; noi_dung: string;
  direction: CVDir; category: string; status: CVStatus; priority: 'normal'|'urgent'|'express';
  date_in: string; date_out?: string; deadline?: string;
  from_to: string; handler: string; tags: string[]; attachments: number;
  reply_to?: string;
}
interface Meeting {
  id: string; title: string; date: string; time_start: string; time_end: string;
  location: string; status: MeetStatus; organizer: string;
  attendees: string[]; agenda: string[]; notes: string; minute_id?: string;
}
interface MeetingMinute {
  id: string; meeting_id: string; meeting_title: string; date: string;
  location: string; attendees: string[]; content: string; decisions: string[];
  action_items: { task: string; assignee: string; deadline: string; done: boolean }[];
  status: MinuteStatus; prepared_by: string;
}

// ─── Configs ─────────────────────────────────────────────────────────────────
const CV_STATUS: Record<CVStatus, { label: string; cls: string; dot: string }> = {
  draft:      { label:'Nháp',          cls:'bg-slate-100 text-slate-600',    dot:'bg-slate-400'   },
  sent:       { label:'Đã gửi',        cls:'bg-blue-100 text-blue-700',      dot:'bg-blue-500'    },
  received:   { label:'Đã nhận',       cls:'bg-teal-100 text-teal-700',      dot:'bg-teal-500'    },
  processing: { label:'Đang xử lý',    cls:'bg-amber-100 text-amber-700',    dot:'bg-amber-500'   },
  closed:     { label:'Đã đóng',       cls:'bg-emerald-100 text-emerald-700',dot:'bg-emerald-500' },
};
const CV_PRIORITY: Record<string, { label: string; cls: string }> = {
  normal:  { label:'Thường',     cls:'bg-slate-100 text-slate-600'  },
  urgent:  { label:'Khẩn',      cls:'bg-amber-100 text-amber-700'  },
  express: { label:'Hỏa tốc',   cls:'bg-rose-100 text-rose-700 font-bold' },
};
const MEET_STATUS: Record<MeetStatus, { label: string; cls: string }> = {
  scheduled:   { label:'Đã lên lịch',  cls:'bg-blue-100 text-blue-700'      },
  in_progress: { label:'Đang diễn ra', cls:'bg-amber-100 text-amber-700'    },
  done:        { label:'Đã kết thúc',  cls:'bg-emerald-100 text-emerald-700'},
  cancelled:   { label:'Đã huỷ',       cls:'bg-slate-100 text-slate-500'    },
};

const GEM_OFFICE_SYS = `Bạn là Nàng GEM Siêu Việt — chuyên gia hành chính văn phòng xây dựng. Xưng "em", gọi "Anh/Chị". Soạn thảo văn bản hành chính chuẩn CHXHCN Việt Nam khi được yêu cầu. Văn phong rõ ràng, chính xác.`;

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300";

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_CVS: CongVan[] = [
  { id:'cv1', so_cv:'CV-2026/001-GĐDA', trich_yeu:'Phê duyệt phương án kỹ thuật xử lý nền đất yếu khu C4-D6',
    noi_dung:'Kính gửi Chỉ huy trưởng công trình Villa PAT. Căn cứ kết quả khảo sát địa chất bổ sung ngày 05/02/2026 và đề xuất phương án xử lý của Tư vấn kết cấu, Ban QLDA chấp thuận triển khai phương án cọc xi măng đất theo đề xuất. Đề nghị đơn vị thi công triển khai ngay sau khi nhận được văn bản này.',
    direction:'outbound', category:'Kỹ thuật', status:'sent', priority:'urgent',
    date_in:'07/03/2026', from_to:'Ban QLDA → Chỉ huy trưởng', handler:'Nguyễn Thị Lan (Thư ký)', tags:['Kỹ thuật','Nền móng'], attachments:2 },
  { id:'cv2', so_cv:'2026/045-TVGS', trich_yeu:'Biên bản nghiệm thu cốt thép dầm tầng 3 — Đạt yêu cầu',
    noi_dung:'Biên bản nghiệm thu công tác cốt thép dầm sàn tầng 3 block A ngày 06/03/2026. Kết quả: Đạt yêu cầu kỹ thuật theo TCVN 9115:2012. Đề nghị tiến hành đổ bê tông theo đúng kế hoạch.',
    direction:'inbound', category:'Nghiệm thu', status:'received', priority:'normal',
    date_in:'06/03/2026', from_to:'TVGS Alpha → Ban QLDA', handler:'Phạm Minh Quân', tags:['Nghiệm thu','Kết cấu'], attachments:1 },
  { id:'cv3', so_cv:'CV-2026/002-CHT', trich_yeu:'Báo cáo tiến độ tháng 2/2026 — Đạt 78% kế hoạch',
    noi_dung:'Báo cáo tiến độ thi công tháng 2/2026. Tổng tiến độ thực hiện đạt 78% so với kế hoạch tháng. Các nguyên nhân chậm: thời tiết xấu 3 ngày (ngày 12-14/02), thiếu vật tư thép D16 trong 4 ngày. Kế hoạch tháng 3: tập trung tầng 3-4 block A, hoàn thiện tầng hầm.',
    direction:'inbound', category:'Báo cáo', status:'processing', priority:'normal',
    date_in:'01/03/2026', deadline:'10/03/2026', from_to:'CHT Nguyễn Văn Anh → GĐ DA', handler:'Trần Thị Mai (Thư ký)', tags:['Báo cáo','Tiến độ'], attachments:3 },
  { id:'cv4', so_cv:'CV-2026/003-GĐDA', trich_yeu:'Chấp thuận điều chỉnh vật tư sơn chống thấm mái (RFI-004)',
    noi_dung:'Trả lời RFI-004 ngày 06/03/2026 của CHT. Ban QLDA chấp thuận sử dụng sơn chống thấm Polyglass thay thế Sika theo đề xuất. Yêu cầu cung cấp đầy đủ hồ sơ chứng nhận chất lượng trước khi thi công.',
    direction:'outbound', category:'Vật tư', status:'sent', priority:'normal',
    date_in:'07/03/2026', from_to:'GĐ DA → CHT Nguyễn Văn Anh', handler:'Nguyễn Thị Lan', tags:['Vật tư','Chống thấm'], attachments:0, reply_to:'RFI-004' },
  { id:'cv5', so_cv:'2026/018-CĐT', trich_yeu:'Yêu cầu đẩy nhanh tiến độ tầng hầm B2 — Hoàn thành trước 30/04',
    noi_dung:'Căn cứ kế hoạch tổng thể dự án, Chủ đầu tư yêu cầu Nhà thầu thi công hoàn thành toàn bộ công tác tầng hầm B2 trước ngày 30/04/2026. Đề nghị lập phương án tăng ca và bổ sung thiết bị báo cáo trước 15/03/2026.',
    direction:'inbound', category:'Chỉ đạo', status:'processing', priority:'express',
    date_in:'05/03/2026', deadline:'15/03/2026', from_to:'CĐT Hoàng Long → Ban QLDA', handler:'Nguyễn Thị Lan', tags:['Tiến độ','Tầng hầm'], attachments:1 },
];

const MOCK_MEETINGS: Meeting[] = [
  { id:'m1', title:'Họp giao ban tuần 10/2026', date:'09/03/2026', time_start:'08:00', time_end:'09:30',
    location:'Phòng họp tại công trường', status:'scheduled', organizer:'GĐ DA Trần Văn Bình',
    attendees:['GĐ DA','CHT Nguyễn Văn Anh','TVGS Alpha','KS Giám sát Hoàng','QS Minh Tuấn'],
    agenda:['Báo cáo tiến độ tuần 9','Giải quyết vướng mắc kỹ thuật','Kế hoạch tuần 10','Các vấn đề khác'],
    notes:'', minute_id:undefined },
  { id:'m2', title:'Họp kỹ thuật xử lý nền đất yếu khu C', date:'06/03/2026', time_start:'14:00', time_end:'16:00',
    location:'Văn phòng Ban QLDA', status:'done', organizer:'CHT Nguyễn Văn Anh',
    attendees:['CHT','TVGS KC','TK Kết cấu','KS Giám sát'],
    agenda:['Báo cáo kết quả khảo sát','Đề xuất phương án','Thống nhất triển khai'],
    notes:'Đã thống nhất phương án cọc xi măng đất. GĐ DA phê duyệt phương án qua CV-2026/001.', minute_id:'min1' },
  { id:'m3', title:'Họp nghiệm thu cốt thép dầm tầng 3', date:'06/03/2026', time_start:'09:00', time_end:'10:00',
    location:'Tại công trường — Tầng 3', status:'done', organizer:'KS Giám sát Hoàng',
    attendees:['KS Giám sát','Đội trưởng KC','TVGS Alpha','QC Thảo'],
    agenda:['Kiểm tra cốt thép theo bản vẽ','Đánh giá kết quả','Ký nghiệm thu'],
    notes:'Đạt yêu cầu. Cho phép đổ bê tông.', minute_id:'min2' },
  { id:'m4', title:'Họp CĐT — Tiến độ tầng hầm B2', date:'12/03/2026', time_start:'10:00', time_end:'11:30',
    location:'Văn phòng CĐT — Tầng 12 Landmark', status:'scheduled', organizer:'CĐT Hoàng Long',
    attendees:['CĐT','GĐ DA','CHT','QS Minh Tuấn'],
    agenda:['Báo cáo hiện trạng tầng hầm','Phương án đẩy nhanh tiến độ','Phê duyệt VO acceleration'],
    notes:'', minute_id:undefined },
];


const MOCK_MINUTES: MeetingMinute[] = [
  { id:'min1', meeting_id:'m2', meeting_title:'Họp kỹ thuật xử lý nền đất yếu khu C', date:'06/03/2026',
    location:'Văn phòng Ban QLDA', status:'confirmed', prepared_by:'Nguyễn Thị Lan',
    attendees:['CHT Nguyễn Văn Anh','TVGS KC Alpha','TK Kết cấu Hùng','KS Giám sát Hoàng'],
    content:'Cuộc họp xem xét kết quả khảo sát địa chất bổ sung và quyết định phương án xử lý nền đất yếu tại khu vực C4-D6, tầng B1. Đại diện TK Kết cấu trình bày kết quả khảo sát: phát hiện lớp bùn sét mềm yếu dày 3.5m. Đề xuất phương án cọc xi măng đất D600.',
    decisions:['Thống nhất phương án cọc xi măng đất D600 — 480 cọc','GĐ DA phê duyệt phương án qua văn bản chính thức','Triển khai ngay sau khi có văn bản phê duyệt','TK Kết cấu hoàn thiện bản vẽ thi công trong 3 ngày'],
    action_items:[
      { task:'Phát hành bản vẽ chi tiết cọc xi măng đất', assignee:'TK Kết cấu Hùng', deadline:'09/03/2026', done:false },
      { task:'Lập dự toán chi phí phương án', assignee:'QS Minh Tuấn', deadline:'09/03/2026', done:true },
      { task:'Chuẩn bị trang thiết bị thi công', assignee:'CHT Nguyễn Văn Anh', deadline:'12/03/2026', done:false },
    ] },
  { id:'min2', meeting_id:'m3', meeting_title:'Họp nghiệm thu cốt thép dầm tầng 3', date:'06/03/2026',
    location:'Tại công trường — Tầng 3', status:'confirmed', prepared_by:'Phạm Minh Quân',
    attendees:['KS Giám sát Hoàng','Đội trưởng KC Thanh','TVGS Alpha Dũng','QC Thảo'],
    content:'Nghiệm thu công tác cốt thép dầm sàn tầng 3 block A theo TCVN 9115:2012.',
    decisions:['Công tác cốt thép đạt yêu cầu kỹ thuật','Cho phép tiến hành đổ bê tông'],
    action_items:[
      { task:'Lập kế hoạch đổ bê tông tầng 3', assignee:'CHT Nguyễn Văn Anh', deadline:'08/03/2026', done:true },
    ] },
];

// ─── Sub-tab: Công văn ────────────────────────────────────────────────────────
function TabCongVan({ cvs, setCvs, pid }: { cvs: CongVan[]; setCvs: React.Dispatch<React.SetStateAction<CongVan[]>>; pid: string }) {
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [dir, setDir] = useState<'all'|CVDir>('all');
  const [filterCat, setFilterCat] = useState('Tất cả');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [gemLoading, setGemLoading] = useState(false);
  const [gemText, setGemText] = useState('');
  const [newCV, setNewCV] = useState({ so_cv:'', trich_yeu:'', noi_dung:'', direction:'outbound' as CVDir, category:'Kỹ thuật', priority:'normal' as any, from_to:'', deadline:'' });

  const cats = ['Tất cả','Kỹ thuật','Nghiệm thu','Báo cáo','Vật tư','Chỉ đạo','Hành chính'];
  const filtered = cvs.filter(c =>
    (dir==='all' || c.direction===dir) &&
    (filterCat==='Tất cả' || c.category===filterCat) &&
    (!search || c.trich_yeu.toLowerCase().includes(search.toLowerCase()) || c.so_cv.toLowerCase().includes(search.toLowerCase()))
  );

  const pending = cvs.filter(c => c.status==='processing' || (c.deadline && c.status!=='closed' && c.status!=='sent')).length;

  const draftWithGEM = async () => {
    if (!newCV.trich_yeu) return notifInfo('Nhập trích yếu trước!');
    setGemLoading(true); setGemText('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY, systemInstruction: GEM_OFFICE_SYS });
      const r = await model.generateContent(`Soạn thảo công văn xây dựng:\nTrích yếu: ${newCV.trich_yeu}\nLoại: ${newCV.category}\nGửi: ${newCV.from_to || 'Ban QLDA → [Đơn vị nhận]'}\nYêu cầu: Soạn nội dung công văn đầy đủ theo mẫu hành chính chuẩn CHXHCN Việt Nam. Gồm: kính gửi, căn cứ, nội dung chính, đề nghị thực hiện, ký kết. Văn phong trang trọng, rõ ràng.`);
      setGemText(r.response.text());
    } catch { setGemText('❌ Không thể kết nối GEM.'); }
    setGemLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Tổng công văn', val:cvs.length, cls:'bg-violet-100 text-violet-700' },
          { label:'Công văn đến', val:cvs.filter(c=>c.direction==='inbound').length, cls:'bg-blue-100 text-blue-700' },
          { label:'Công văn đi', val:cvs.filter(c=>c.direction==='outbound').length, cls:'bg-teal-100 text-teal-700' },
          { label:'Cần xử lý', val:pending, cls: pending>0?'bg-rose-100 text-rose-700':'bg-emerald-100 text-emerald-700' },
        ].map((k,i)=>(
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><Mail size={16}/></div>
            <div className="text-2xl font-bold text-slate-800">{k.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* GEM panel */}
      {gemText && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-violet-800 text-sm flex items-center gap-2"><Sparkles size={15} className="text-violet-600"/>Nàng GEM — Soạn thảo công văn</span>
            <div className="flex gap-2">
              <button onClick={()=>{setNewCV(p=>({...p,noi_dung:gemText}));setGemText('');}} className="px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-lg">Dùng nội dung này</button>
              <button onClick={()=>setGemText('')} className="p-1 hover:bg-violet-100 rounded-lg"><X size={13}/></button>
            </div>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{gemText}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          {(['all','inbound','outbound'] as const).map(d=>(
            <button key={d} onClick={()=>setDir(d)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${dir===d?'bg-violet-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {d==='all'?'Tất cả':d==='inbound'?'📥 Công văn đến':'📤 Công văn đi'}
            </button>
          ))}
          {cats.map(c=>(
            <button key={c} onClick={()=>setFilterCat(c)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filterCat===c?'bg-slate-700 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c}</button>
          ))}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm công văn..." className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 w-36"/>
          </div>
        </div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
          <Plus size={15}/> Công văn mới
        </button>
      </div>

      {/* CV List */}
      <div className="space-y-2">
        {filtered.map(cv=>{
          const st = CV_STATUS[cv.status]; const pr = CV_PRIORITY[cv.priority];
          const isExpanded = expandedId===cv.id;
          return (
            <div key={cv.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${cv.priority==='express'?'border-rose-200':cv.status==='processing'?'border-amber-200':'border-slate-200'}`}>
              <div className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50" onClick={()=>setExpandedId(isExpanded?null:cv.id)}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cv.direction==='inbound'?'bg-blue-100':'bg-teal-100'}`}>
                  {cv.direction==='inbound'?<Inbox size={17} className="text-blue-600"/>:<Send size={17} className="text-teal-600"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-[10px] font-bold text-slate-500">{cv.so_cv}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pr.cls}`}>{pr.label}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>{st.label}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{cv.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 line-clamp-1">{cv.trich_yeu}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{cv.from_to} · {cv.date_in}{cv.deadline&&` · Hạn: ${cv.deadline}`}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Xử lý: {cv.handler}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cv.attachments>0&&<span className="text-[10px] text-slate-400 flex items-center gap-1"><Paperclip size={10}/>{cv.attachments}</span>}
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded?'rotate-180':''}`}/>
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wide">Nội dung</p>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{cv.noi_dung}</p>
                  </div>
                  {cv.tags.length>0&&(
                    <div className="flex gap-1.5 flex-wrap">
                      {cv.tags.map(t=><span key={t} className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">{t}</span>)}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {cv.status==='received'&&<button onClick={()=>setCvs(prev => { const next = prev.map(c=>c.id===cv.id?{...c,status:'processing' as CVStatus}:c); db.set('office_congvan', pid, next); return next; })} className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100">Bắt đầu xử lý</button>}
                    {cv.status==='processing'&&<button onClick={()=>setCvs(prev => { const next = prev.map(c=>c.id===cv.id?{...c,status:'closed' as CVStatus}:c); db.set('office_congvan', pid, next); return next; })} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">Đóng công văn</button>}
                    <button className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1"><Printer size={11}/>In</button>
                    <button className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1"><Download size={11}/>Tải về</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create CV Modal */}
      <ModalForm
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Tạo công văn mới"
        subtitle="Công văn đi / Công văn đến"
        icon={<Mail size={18}/>}
        color="violet"
        width="lg"
        footer={<>
          <BtnCancel onClick={() => setShowForm(false)}/>
          <BtnSubmit label="Lưu công văn" onClick={() => {
            if (!newCV.so_cv?.trim())   { notifErr('Vui lòng nhập số hiệu CV!'); return; }
            if (!newCV.trich_yeu?.trim()) { notifErr('Vui lòng nhập trích yếu!'); return; }
            const cv: CongVan = { id:'cv_'+Date.now(), so_cv:newCV.so_cv, trich_yeu:newCV.trich_yeu, noi_dung:newCV.noi_dung, direction:newCV.direction, category:newCV.category, status: newCV.direction==='outbound'?'sent':'received', priority:newCV.priority, date_in:new Date().toLocaleDateString('vi-VN'), deadline:newCV.deadline||undefined, from_to:newCV.from_to, handler:'Người dùng hiện tại', tags:[], attachments:0 };
            setCvs(prev => { const next = [cv, ...prev]; db.set('office_congvan', pid, next); return next; }); setShowForm(false);
            setNewCV({ so_cv:'', trich_yeu:'', noi_dung:'', direction:'outbound', category:'Kỹ thuật', priority:'normal', from_to:'', deadline:'' });
          }}/>
        </>}
      >
        <FormSection title="Thông tin chung">
          <FormGrid cols={2}>
            <FormRow label="Số hiệu CV *"><input className={inputCls} placeholder="VD: CV-2026/004-GĐDA" value={newCV.so_cv} onChange={e=>setNewCV(p=>({...p,so_cv:e.target.value}))}/></FormRow>
            <FormRow label="Loại">
              <select className={selectCls} value={newCV.direction} onChange={e=>setNewCV(p=>({...p,direction:e.target.value as CVDir}))}>
                <option value="outbound">Công văn đi</option><option value="inbound">Công văn đến</option>
              </select>
            </FormRow>
            <div className="col-span-2"><FormRow label="Trích yếu *"><input className={inputCls} placeholder="Nội dung trích yếu ngắn gọn" value={newCV.trich_yeu} onChange={e=>setNewCV(p=>({...p,trich_yeu:e.target.value}))}/></FormRow></div>
            <FormRow label="Danh mục">
              <select className={selectCls} value={newCV.category} onChange={e=>setNewCV(p=>({...p,category:e.target.value}))}>
                {['Kỹ thuật','Nghiệm thu','Báo cáo','Vật tư','Chỉ đạo','Hành chính'].map(c=><option key={c}>{c}</option>)}
              </select>
            </FormRow>
            <FormRow label="Độ ưu tiên">
              <select className={selectCls} value={newCV.priority} onChange={e=>setNewCV(p=>({...p,priority:e.target.value as any}))}>
                <option value="normal">Thường</option><option value="urgent">Khẩn</option><option value="express">Hỏa tốc</option>
              </select>
            </FormRow>
            <FormRow label="Gửi / Nhận từ"><input className={inputCls} placeholder="VD: Ban QLDA → CHT" value={newCV.from_to} onChange={e=>setNewCV(p=>({...p,from_to:e.target.value}))}/></FormRow>
            <FormRow label="Hạn xử lý"><input className={inputCls} placeholder="DD/MM/YYYY" value={newCV.deadline} onChange={e=>setNewCV(p=>({...p,deadline:e.target.value}))}/></FormRow>
          </FormGrid>
        </FormSection>
        <FormSection title="Nội dung">
          <div className="flex items-center justify-end mb-2">
            <button onClick={draftWithGEM} disabled={gemLoading} className="flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-200 disabled:opacity-50">
              {gemLoading?<Loader2 size={11} className="animate-spin"/>:<Sparkles size={11}/>} GEM soạn thảo
            </button>
          </div>
          <textarea rows={6} placeholder="Nhập nội dung hoặc dùng GEM soạn thảo tự động..." value={newCV.noi_dung} onChange={e=>setNewCV(p=>({...p,noi_dung:e.target.value}))} className={inputCls + " resize-none w-full"}/>
        </FormSection>
      </ModalForm>
    </div>
  );
}

// ─── Sub-tab: Lịch họp ────────────────────────────────────────────────────────
function TabLichHop({ meetings, setMeetings, pid }: { meetings: Meeting[]; setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>; pid: string }) {
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [gemLoading, setGemLoading] = useState(false);
  const [gemText, setGemText] = useState('');
  const [newMeet, setNewMeet] = useState({ title:'', date:'', time_start:'08:00', time_end:'09:30', location:'', organizer:'', agenda_raw:'' });

  const upcoming = meetings.filter(m=>m.status==='scheduled');
  const done = meetings.filter(m=>m.status==='done');

  const draftAgenda = async () => {
    if(!newMeet.title) return notifInfo('Nhập tiêu đề họp trước!');
    setGemLoading(true); setGemText('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY, systemInstruction: GEM_OFFICE_SYS });
      const r = await model.generateContent(`Soạn chương trình nghị sự (agenda) cho cuộc họp:\nTiêu đề: ${newMeet.title}\nThời gian: ${newMeet.time_start}–${newMeet.time_end}\nĐịa điểm: ${newMeet.location||'Phòng họp công trường'}\nTạo 4-6 mục agenda cụ thể, phù hợp với cuộc họp xây dựng. Mỗi mục một dòng, có thời lượng dự kiến.`);
      setGemText(r.response.text());
    } catch { setGemText('❌ Không kết nối được GEM.'); }
    setGemLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Tổng cuộc họp', val:meetings.length, cls:'bg-violet-100 text-violet-700' },
          { label:'Sắp diễn ra', val:upcoming.length, cls:'bg-blue-100 text-blue-700' },
          { label:'Đã kết thúc', val:done.length, cls:'bg-emerald-100 text-emerald-700' },
          { label:'Có biên bản', val:meetings.filter(m=>m.minute_id).length, cls:'bg-teal-100 text-teal-700' },
        ].map((k,i)=>(
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><Calendar size={16}/></div>
            <div className="text-2xl font-bold text-slate-800">{k.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {upcoming.length>0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5"><Bell size={13}/>Cuộc họp sắp tới</p>
          {upcoming.map(m=>(
            <div key={m.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-blue-100 mb-2 last:mb-0">
              <div><p className="text-sm font-semibold text-slate-800">{m.title}</p><p className="text-xs text-blue-600">{m.date} · {m.time_start}–{m.time_end} · {m.location}</p></div>
              <button onClick={()=>setMeetings(p=>p.map(x=>x.id===m.id?{...x,status:'in_progress' as MeetStatus}:x))} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shrink-0">Bắt đầu họp</button>
            </div>
          ))}
        </div>
      )}

      {gemText && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-violet-800 text-sm flex items-center gap-2"><Sparkles size={14} className="text-violet-600"/>GEM soạn Agenda</span>
            <div className="flex gap-2">
              <button onClick={()=>{setNewMeet(p=>({...p,agenda_raw:gemText}));setGemText('');}} className="px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-lg">Dùng agenda này</button>
              <button onClick={()=>setGemText('')} className="p-1 hover:bg-violet-100 rounded-lg"><X size={13}/></button>
            </div>
          </div>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">{gemText}</p>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
          <Plus size={15}/> Lên lịch họp
        </button>
      </div>

      <div className="space-y-3">
        {meetings.map(m=>{
          const st = MEET_STATUS[m.status]; const isExpanded = expandedId===m.id;
          return (
            <div key={m.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${m.status==='scheduled'?'border-blue-200':m.status==='in_progress'?'border-amber-200':'border-slate-200'}`}>
              <div className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50" onClick={()=>setExpandedId(isExpanded?null:m.id)}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.status==='done'?'bg-emerald-100':m.status==='in_progress'?'bg-amber-100':'bg-blue-100'}`}>
                    <Calendar size={17} className={m.status==='done'?'text-emerald-600':'text-blue-600'}/>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      {m.minute_id&&<span className="text-[10px] px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-semibold">Có biên bản</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.date} · {m.time_start}–{m.time_end} · {m.location}</p>
                    <p className="text-[11px] text-slate-400">Chủ trì: {m.organizer} · {m.attendees.length} người tham dự</p>
                  </div>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isExpanded?'rotate-180':''}`}/>
              </div>
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Chương trình nghị sự</p>
                      <ol className="space-y-1">
                        {m.agenda.map((a,i)=><li key={i} className="text-xs text-slate-700 flex gap-2"><span className="text-slate-400 shrink-0">{i+1}.</span>{a}</li>)}
                      </ol>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Thành phần tham dự</p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.attendees.map(a=><span key={a} className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-600">{a}</span>)}
                      </div>
                    </div>
                  </div>
                  {m.notes&&<div className="bg-teal-50 border border-teal-100 rounded-xl p-3"><p className="text-[10px] font-bold text-teal-600 uppercase mb-1">Kết quả / Ghi chú</p><p className="text-xs text-teal-800">{m.notes}</p></div>}
                  <div className="flex gap-2 flex-wrap">
                    {m.status==='done'&&!m.minute_id&&(
                      <button onClick={()=>setMeetings(p=>p.map(x=>x.id===m.id?{...x,minute_id:'min_'+Date.now()}:x))} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold hover:bg-teal-100">
                        <FileText size={11}/> Lập biên bản
                      </button>
                    )}
                    {m.status==='in_progress'&&(
                      <button onClick={()=>setMeetings(p=>p.map(x=>x.id===m.id?{...x,status:'done' as MeetStatus}:x))} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">
                        <CheckCircle2 size={11}/> Kết thúc họp
                      </button>
                    )}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"><Printer size={11}/>In lịch</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ModalForm
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Lên lịch họp mới"
        subtitle="Tạo cuộc họp và chương trình nghị sự"
        icon={<Calendar size={18}/>}
        color="violet"
        width="md"
        footer={<>
          <BtnCancel onClick={() => setShowForm(false)}/>
          <BtnSubmit label="Lưu lịch họp" onClick={() => {
            if (!newMeet.title?.trim()) { notifErr('Vui lòng nhập tiêu đề cuộc họp!'); return; }
            if (!newMeet.date?.trim())  { notifErr('Vui lòng nhập ngày họp!'); return; }
            const m: Meeting = { id:'m_'+Date.now(), title:newMeet.title, date:newMeet.date, time_start:newMeet.time_start, time_end:newMeet.time_end, location:newMeet.location, status:'scheduled', organizer:newMeet.organizer, attendees:[], agenda:newMeet.agenda_raw.split('\n').filter(Boolean), notes:'' };
            setMeetings(prev => { const next = [...prev, m]; db.set('office_meetings', pid, next); return next; }); setShowForm(false);
            setNewMeet({ title:'', date:'', time_start:'08:00', time_end:'09:30', location:'', organizer:'', agenda_raw:'' });
          }}/>
        </>}
      >
        <FormSection title="Thông tin cuộc họp">
          <FormGrid cols={2}>
            <div className="col-span-2"><FormRow label="Tiêu đề *"><input className={inputCls} placeholder="VD: Họp giao ban tuần 11" value={newMeet.title} onChange={e=>setNewMeet(p=>({...p,title:e.target.value}))}/></FormRow></div>
            <FormRow label="Ngày *"><input className={inputCls} placeholder="DD/MM/YYYY" value={newMeet.date} onChange={e=>setNewMeet(p=>({...p,date:e.target.value}))}/></FormRow>
            <FormRow label="Địa điểm"><input className={inputCls} placeholder="Phòng họp, địa chỉ..." value={newMeet.location} onChange={e=>setNewMeet(p=>({...p,location:e.target.value}))}/></FormRow>
            <FormRow label="Bắt đầu"><input type="time" className={inputCls} value={newMeet.time_start} onChange={e=>setNewMeet(p=>({...p,time_start:e.target.value}))}/></FormRow>
            <FormRow label="Kết thúc"><input type="time" className={inputCls} value={newMeet.time_end} onChange={e=>setNewMeet(p=>({...p,time_end:e.target.value}))}/></FormRow>
            <div className="col-span-2"><FormRow label="Chủ trì"><input className={inputCls} placeholder="Tên người chủ trì" value={newMeet.organizer} onChange={e=>setNewMeet(p=>({...p,organizer:e.target.value}))}/></FormRow></div>
          </FormGrid>
        </FormSection>
        <FormSection title="Chương trình nghị sự">
          <div className="flex items-center justify-end mb-2">
            <button onClick={draftAgenda} disabled={gemLoading} className="flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-200 disabled:opacity-50">
              {gemLoading?<Loader2 size={11} className="animate-spin"/>:<Sparkles size={11}/>} GEM soạn agenda
            </button>
          </div>
          <textarea rows={4} placeholder="Mỗi mục một dòng..." value={newMeet.agenda_raw} onChange={e=>setNewMeet(p=>({...p,agenda_raw:e.target.value}))} className={inputCls + " resize-none w-full"}/>
        </FormSection>
      </ModalForm>
    </div>
  );
}

// ─── Sub-tab: Ký duyệt ────────────────────────────────────────────────────────
function TabKyDuyet({ docs, refresh, pid, ctx, onTriggerApproval }: {
  docs: ApprovalDoc[];
  refresh: () => void;
  pid: string;
  ctx: UserContext;
  onTriggerApproval?: (title: string) => void;
}) {
  const { ok: notifOk, err: notifErr } = useNotification();
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [newDoc, setNewDoc]         = useState({ title:'', docType:'LEAVE_REQUEST' as const, description:'', deadline:'' });

  const pending  = docs.filter(d => d.status === 'SUBMITTED' || d.status === 'IN_REVIEW').length;
  const approved = docs.filter(d => d.status === 'APPROVED' || d.status === 'COMPLETED').length;
  const returned = docs.filter(d => d.status === 'RETURNED' || d.status === 'REJECTED').length;

  const handleAction = (doc: ApprovalDoc, action: 'APPROVE' | 'RETURN' | 'REJECT') => {
    const r = processApproval({ projectId: pid, docId: doc.id, action, ctx });
    if (r.ok) { notifOk(`✅ Đã ${action === 'APPROVE' ? 'phê duyệt' : action === 'RETURN' ? 'trả lại' : 'từ chối'} "${doc.title}"`); refresh(); }
    else notifErr(`❌ ${(r as any).error}`);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Tổng văn bản',       val:docs.length, cls:'bg-violet-100 text-violet-700' },
          { label:'Chờ phê duyệt',      val:pending,  cls:pending>0?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600' },
          { label:'Đã phê duyệt',       val:approved, cls:'bg-emerald-100 text-emerald-700' },
          { label:'Trả lại / Từ chối',  val:returned, cls:returned>0?'bg-rose-100 text-rose-700':'bg-slate-100 text-slate-600' },
        ].map((k,i)=>(
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><CheckSquare size={16}/></div>
            <div className="text-2xl font-bold text-slate-800">{k.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {returned > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0"/>
          <div>
            <p className="font-bold text-orange-800 text-sm">Có {returned} văn bản bị trả lại — cần bổ sung</p>
            {docs.filter(d=>d.status==='RETURNED'||d.status==='REJECTED').map(d=><p key={d.id} className="text-xs text-orange-600 mt-0.5">• {d.title}</p>)}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
          <Plus size={15}/> Trình ký duyệt
        </button>
      </div>

      <div className="space-y-3">
        {docs.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <CheckSquare size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">Chưa có văn bản nào. Nhấn "Trình ký duyệt" để tạo mới.</p>
          </div>
        )}
        {docs.map(doc => {
          const st = getStatusConfig(doc.status);
          const progress = getWorkflowProgress(doc);
          const stepLabel = getCurrentStepLabel(doc);
          const isExpanded = expandedId === doc.id;
          const canAct = doc.status === 'SUBMITTED' || doc.status === 'IN_REVIEW';
          return (
            <div key={doc.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${
              canAct ? 'border-amber-200' : doc.status==='RETURNED'||doc.status==='REJECTED' ? 'border-rose-200' : 'border-slate-200'
            }`}>
              <div className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedId(isExpanded ? null : doc.id)}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg`}
                    style={{background: st.bgColor}}>{st.icon}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{background: st.bgColor, color: st.color}}>{st.label}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{doc.docType}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{doc.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tạo bởi: {doc.createdByName} · {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">{stepLabel}</p>
                    <p className="text-[10px] text-slate-400">{progress}%</p>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded?'rotate-180':''}`}/>
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-3">
                  {doc.data?.description && (
                    <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3">{doc.data.description}</p>
                  )}
                  {/* Audit log */}
                  {doc.auditLog.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Lịch sử xử lý</p>
                      <div className="space-y-1">
                        {doc.auditLog.slice(-3).map((log, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-medium text-slate-700">{log.userName}</span>
                            <span>{log.action}</span>
                            <span>{new Date(log.timestamp).toLocaleDateString('vi-VN')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {canAct && (
                      <>
                        <button onClick={() => handleAction(doc, 'APPROVE')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">
                          <Check size={11}/> Phê duyệt
                        </button>
                        <button onClick={() => handleAction(doc, 'RETURN')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100">
                          <ArrowLeft size={11}/> Trả lại
                        </button>
                        <button onClick={() => handleAction(doc, 'REJECT')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100">
                          <X size={11}/> Từ chối
                        </button>
                      </>
                    )}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">
                      <Printer size={11}/>In
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ModalForm
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Trình văn bản ký duyệt"
        subtitle="Tạo yêu cầu phê duyệt"
        icon={<CheckSquare size={18}/>}
        color="violet"
        width="md"
        footer={<>
          <BtnCancel onClick={() => setShowForm(false)}/>
          <BtnSubmit label="Trình ký duyệt" onClick={() => {
            if (!newDoc.title?.trim()) { notifErr('Vui lòng nhập tên văn bản!'); return; }
            const cr = createDocument({ projectId: pid, docType: newDoc.docType, title: newDoc.title, data: { description: newDoc.description, deadline: newDoc.deadline }, ctx });
            if (!cr.ok) { notifErr(`❌ ${(cr as any).error}`); return; }
            const sr = submitDocument(pid, cr.data!.id, ctx);
            if (sr.ok) { notifOk('✅ Đã trình ký duyệt!'); refresh(); setShowForm(false); setNewDoc({ title:'', docType:'LEAVE_REQUEST', description:'', deadline:'' }); }
            else notifErr(`❌ ${(sr as any).error}`);
          }}/>
        </>}
      >
        <FormGrid cols={2}>
          <div className="col-span-2"><FormRow label="Tên văn bản *">
            <input className={inputCls} placeholder="VD: Đề xuất nghỉ phép 3 ngày" value={newDoc.title} onChange={e=>setNewDoc(p=>({...p,title:e.target.value}))}/>
          </FormRow></div>
          <div className="col-span-2"><FormRow label="Loại văn bản">
            <select className={selectCls} value={newDoc.docType} onChange={e=>setNewDoc(p=>({...p,docType:e.target.value as 'LEAVE_REQUEST'}))}>
              <option value="LEAVE_REQUEST">Đề xuất nghỉ phép</option>
              <option value="DISCIPLINE">Xử lý kỷ luật</option>
              <option value="OVERTIME_REQUEST">Đề xuất tăng ca</option>
            </select>
          </FormRow></div>
          <FormRow label="Hạn phê duyệt">
            <input className={inputCls} placeholder="DD/MM/YYYY" value={newDoc.deadline} onChange={e=>setNewDoc(p=>({...p,deadline:e.target.value}))}/>
          </FormRow>
          <div className="col-span-2"><FormRow label="Mô tả ngắn">
            <textarea rows={3} className={inputCls + " resize-none"} value={newDoc.description} onChange={e=>setNewDoc(p=>({...p,description:e.target.value}))}/>
          </FormRow></div>
        </FormGrid>
      </ModalForm>
    </div>
  );
}


// ─── Sub-tab: Biên bản họp ────────────────────────────────────────────────────
function TabBienBan({ minutes, setMinutes, meetings, pid }: { minutes: MeetingMinute[]; setMinutes: React.Dispatch<React.SetStateAction<MeetingMinute[]>>; meetings: Meeting[]; pid: string }) {
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [gemLoading, setGemLoading] = useState(false);
  const [gemText, setGemText] = useState('');
  const [draftFor, setDraftFor] = useState<MeetingMinute|null>(null);
  const [newMin, setNewMin] = useState({ meeting_title:'', date:'', location:'', content:'', decisions_raw:'', action_raw:'', prepared_by:'' });

  const draftWithGEM = async (m: MeetingMinute) => {
    setDraftFor(m); setGemLoading(true); setGemText('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY, systemInstruction: GEM_OFFICE_SYS });
      const r = await model.generateContent(`Soạn biên bản họp đầy đủ:\nTiêu đề: ${m.meeting_title}\nNgày: ${m.date} · Địa điểm: ${m.location}\nThành phần: ${m.attendees.join(', ')}\nNội dung cuộc họp: ${m.content}\nCác quyết định: ${m.decisions.join('; ')}\nCác hành động cần thực hiện: ${m.action_items.map(a=>`${a.task} (${a.assignee}, hạn ${a.deadline})`).join('; ')}\n\nSoạn biên bản họp chuẩn format CHXHCN Việt Nam: tiêu đề, thành phần, nội dung thảo luận, kết luận/quyết định, phân công công việc, chữ ký.`);
      setGemText(r.response.text());
    } catch { setGemText('❌ Không kết nối được GEM.'); }
    setGemLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label:'Tổng biên bản', val:minutes.length, cls:'bg-violet-100 text-violet-700' },
          { label:'Đã xác nhận', val:minutes.filter(m=>m.status==='confirmed').length, cls:'bg-emerald-100 text-emerald-700' },
          { label:'Việc cần làm còn lại', val:minutes.reduce((s,m)=>s+m.action_items.filter(a=>!a.done).length,0), cls:'bg-amber-100 text-amber-700' },
        ].map((k,i)=>(
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><BookOpen size={16}/></div>
            <div className="text-2xl font-bold text-slate-800">{k.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {gemText && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-violet-800 text-sm flex items-center gap-2"><Sparkles size={14} className="text-violet-600"/>GEM soạn biên bản — {draftFor?.meeting_title}</span>
            <div className="flex gap-2">
              <button onClick={()=>setGemText('')} className="p-1 hover:bg-violet-100 rounded-lg"><X size={13}/></button>
            </div>
          </div>
          <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{gemText}</pre>
          <div className="flex gap-2 mt-3">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700"><Printer size={11}/>In biên bản</button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-violet-200 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-50"><Download size={11}/>Tải về</button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
          <Plus size={15}/> Lập biên bản
        </button>
      </div>

      <div className="space-y-3">
        {minutes.map(m=>{
          const isExpanded = expandedId===m.id;
          const pending = m.action_items.filter(a=>!a.done).length;
          return (
            <div key={m.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50" onClick={()=>setExpandedId(isExpanded?null:m.id)}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0"><BookOpen size={17} className="text-violet-600"/></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.status==='confirmed'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{m.status==='confirmed'?'Đã xác nhận':'Nháp'}</span>
                      {pending>0&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">{pending} việc chưa xong</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{m.meeting_title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.date} · {m.location} · Lập bởi: {m.prepared_by}</p>
                  </div>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isExpanded?'rotate-180':''}`}/>
              </div>
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-4">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wide">Nội dung cuộc họp</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{m.content}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Quyết định thống nhất</p>
                    <ol className="space-y-1">
                      {m.decisions.map((d,i)=><li key={i} className="text-xs text-slate-700 flex gap-2"><span className="text-emerald-500 font-bold shrink-0">{i+1}.</span>{d}</li>)}
                    </ol>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Phân công công việc</p>
                    <div className="space-y-1.5">
                      {m.action_items.map((a,i)=>(
                        <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl ${a.done?'bg-emerald-50 border border-emerald-100':'bg-amber-50 border border-amber-100'}`}>
                          <button onClick={()=>setMinutes(p=>p.map(mn=>mn.id===m.id?{...mn,action_items:mn.action_items.map((ai,j)=>j===i?{...ai,done:!ai.done}:ai)}:mn))}
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${a.done?'bg-emerald-500 text-white':'border-2 border-amber-400'}`}>
                            {a.done&&<Check size={11}/>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${a.done?'line-through text-slate-400':'text-slate-700'}`}>{a.task}</p>
                            <p className="text-[10px] text-slate-400">{a.assignee} · Hạn: {a.deadline}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={()=>draftWithGEM(m)} disabled={gemLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50">
                      {gemLoading?<Loader2 size={12} className="animate-spin"/>:<Sparkles size={12}/>} GEM soạn biên bản chính thức
                    </button>
                    {m.status==='draft'&&<button onClick={()=>setMinutes(p=>p.map(x=>x.id===m.id?{...x,status:'confirmed' as MinuteStatus}:x))} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100"><CheckCircle2 size={11}/>Xác nhận</button>}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"><Printer size={11}/>In</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ModalForm
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Lập biên bản họp"
        subtitle="Ghi nhận nội dung và quyết định cuộc họp"
        icon={<BookOpen size={18}/>}
        color="violet"
        width="lg"
        footer={<>
          <BtnCancel onClick={() => setShowForm(false)}/>
          <BtnSubmit label="Lưu biên bản" onClick={() => {
            if (!newMin.meeting_title?.trim()) { notifErr('Vui lòng nhập tên cuộc họp!'); return; }
            const mn: MeetingMinute = { id:'min_'+Date.now(), meeting_id:'', meeting_title:newMin.meeting_title, date:newMin.date||new Date().toLocaleDateString('vi-VN'), location:newMin.location, attendees:[], content:newMin.content, decisions:newMin.decisions_raw.split('\n').filter(Boolean), action_items:[], status:'draft', prepared_by:newMin.prepared_by };
            setMinutes(prev => { const next = [mn, ...prev]; db.set('office_minutes', pid, next); return next; }); setShowForm(false);
            setNewMin({ meeting_title:'', date:'', location:'', content:'', decisions_raw:'', action_raw:'', prepared_by:'' });
          }}/>
        </>}
      >
        <FormGrid cols={2}>
          <div className="col-span-2"><FormRow label="Tên cuộc họp *"><input className={inputCls} value={newMin.meeting_title} onChange={e=>setNewMin(p=>({...p,meeting_title:e.target.value}))}/></FormRow></div>
          <FormRow label="Ngày"><input className={inputCls} placeholder="DD/MM/YYYY" value={newMin.date} onChange={e=>setNewMin(p=>({...p,date:e.target.value}))}/></FormRow>
          <FormRow label="Địa điểm"><input className={inputCls} value={newMin.location} onChange={e=>setNewMin(p=>({...p,location:e.target.value}))}/></FormRow>
          <div className="col-span-2"><FormRow label="Người lập biên bản"><input className={inputCls} value={newMin.prepared_by} onChange={e=>setNewMin(p=>({...p,prepared_by:e.target.value}))}/></FormRow></div>
          <div className="col-span-2"><FormRow label="Nội dung thảo luận"><textarea rows={3} className={inputCls + " resize-none"} value={newMin.content} onChange={e=>setNewMin(p=>({...p,content:e.target.value}))}/></FormRow></div>
          <div className="col-span-2"><FormRow label="Quyết định (mỗi dòng một quyết định)"><textarea rows={3} className={inputCls + " resize-none"} placeholder={"Quyết định 1\nQuyết định 2..."} value={newMin.decisions_raw} onChange={e=>setNewMin(p=>({...p,decisions_raw:e.target.value}))}/></FormRow></div>
        </FormGrid>
      </ModalForm>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OfficeDashboard({ project, projectId: projectIdProp }: Props) {
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [tab, setTab] = useState<'congvan'|'lichhop'|'kyduyet'|'bienban'>('congvan');
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);

  const pid = projectIdProp ?? project?.id ?? 'p1';
  const currentMember = getCurrentMember(pid);
  const ctx: UserContext = React.useMemo(() => buildCtxFromMember(currentMember), [currentMember]);
  const dbLoaded = React.useRef(false);

  // ── Lifted data state ──────────────────────────────────────────────────────
  const [cvs,      setCvs]      = useState<CongVan[]>(MOCK_CVS);
  const [meetings, setMeetings] = useState<Meeting[]>(MOCK_MEETINGS);
  const [officeDocs, setOfficeDocs] = useState<ApprovalDoc[]>(() => getAllDocs(pid, ctx));
  const [minutes,  setMinutes]  = useState<MeetingMinute[]>(MOCK_MINUTES);

  // ── Load from db on mount ──────────────────────────────────────────────────
  React.useEffect(() => {
    dbLoaded.current = false;
    (async () => {
      try {
        const [savedCvs, savedMtgs, savedDocs, savedMins] = await Promise.all([
          db.get<CongVan[]>('office_congvan',   pid, MOCK_CVS),
          db.get<Meeting[]>('office_meetings',  pid, MOCK_MEETINGS),
          getAllDocs(pid, ctx),
          db.get<MeetingMinute[]>('office_minutes', pid, MOCK_MINUTES),
        ]);
        setCvs(savedCvs);
        setMeetings(savedMtgs);
        setOfficeDocs(savedDocs);
        setMinutes(savedMins);
      } catch (e) {
        console.warn('[OfficeDashboard] load error:', e);
      } finally {
        dbLoaded.current = true;
      }
    })();
  }, [pid]);

  // ── Realtime sync ──────────────────────────────────────────────────────────
  useRealtimeSync(pid, ['office_congvan','office_meetings','office_approvals','office_minutes'], async () => {
    const [savedCvs, savedMtgs, savedDocs, savedMins] = await Promise.all([
      db.get<CongVan[]>('office_congvan',   pid, MOCK_CVS),
      db.get<Meeting[]>('office_meetings',  pid, MOCK_MEETINGS),
      getAllDocs(pid, ctx),
      db.get<MeetingMinute[]>('office_minutes', pid, MOCK_MINUTES),
    ]);
    setCvs(savedCvs); setMeetings(savedMtgs); setOfficeDocs(savedDocs); setMinutes(savedMins);
  });

  const [offQueue, setOffQueue] = useState<ApprovalDoc[]>(() => getApprovalQueue(pid, ctx));
  const refreshOffQueue = useCallback(() => setOffQueue(getApprovalQueue(pid, ctx)), [pid]);
  useEffect(() => { refreshOffQueue(); }, [refreshOffQueue]);

  const triggerOffDoc = useCallback((title: string, docType: any, data = {}) => {
    if (!WORKFLOWS[docType as keyof typeof WORKFLOWS]) return;
    const cr = createDocument({ projectId: pid, docType, ctx, title, data });
    if (!cr.ok) { notifErr(`❌ ${(cr as any).error}`); return; }
    const sr = submitDocument(pid, (cr as any).data!.id, ctx);
    if (sr.ok) refreshOffQueue();
    else notifErr(`❌ ${(sr as any).error}`);
  }, [pid, ctx, refreshOffQueue]);

  const tabs = [
    { id:'congvan'  as const, label:'Sổ công văn',   icon:<Mail size={14}/>        },
    { id:'lichhop'  as const, label:'Lịch họp',       icon:<Calendar size={14}/>    },
    { id:'kyduyet'  as const, label:'Ký duyệt',       icon:<CheckSquare size={14}/> },
    { id:'bienban'  as const, label:'Biên bản họp',   icon:<BookOpen size={14}/>    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Building2 size={20} className="text-violet-600"/>
            Văn phòng & Hành chính — {project?.name||'Dự án'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Sổ công văn · Lịch họp · Ký duyệt văn bản · Biên bản họp tự động</p>
        </div>
        <button onClick={() => setShowApprovalPanel(true)}
          className="relative flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-violet-300 rounded-xl text-xs font-semibold text-slate-600 shadow-sm transition-all">
          <ClipboardList size={13}/> Hàng duyệt VP
          {offQueue.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
              {offQueue.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t.id?'bg-white shadow-sm text-violet-700':'text-slate-500 hover:text-slate-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab==='congvan'  && <TabCongVan cvs={cvs} setCvs={setCvs} pid={pid}/>}
      {tab==='lichhop'  && <TabLichHop meetings={meetings} setMeetings={setMeetings} pid={pid}/>}
      {tab==='kyduyet'  && <TabKyDuyet docs={officeDocs} refresh={() => setOfficeDocs(getAllDocs(pid, ctx))} pid={pid} ctx={ctx} onTriggerApproval={(title: string) => triggerOffDoc(title, 'LEAVE_REQUEST')} />}
      {tab==='bienban'  && <TabBienBan minutes={minutes} setMinutes={setMinutes} meetings={meetings} pid={pid}/>}

      {/* Approval Queue Drawer */}
      {showApprovalPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowApprovalPanel(false)}/>
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            <ApprovalQueue
              projectId={pid}
              projectName={project?.name || 'Dự án'}
              ctx={ctx}
              onClose={() => { setShowApprovalPanel(false); refreshOffQueue(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
