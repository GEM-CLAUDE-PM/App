import React, { useState, useCallback, useContext, createContext, useRef } from 'react';
import { ZaloService, type ZaloRecipient } from './ZaloService';
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import {
  Bell, BellOff, Send, Mail, MessageSquare, CheckCircle2,
  AlertTriangle, Clock, X, Plus, Save, Sparkles, Loader2,
  Settings, ChevronDown, Eye, Trash2, RefreshCw, Zap,
  Calendar, FileText, Users, DollarSign, HardHat, Flag,
  CheckSquare, Circle, ToggleLeft, ToggleRight, Edit3,
  Building2
} from 'lucide-react';

import type { Project } from './types';

interface Props { project: Project; }

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifChannel = 'zalo' | 'email' | 'inapp';
type NotifStatus  = 'sent' | 'pending' | 'failed' | 'scheduled';
type TriggerType  = 'deadline' | 'threshold' | 'schedule' | 'event';

interface NotifRule {
  id: string; name: string; active: boolean;
  trigger: TriggerType; triggerDesc: string;
  channels: NotifChannel[]; recipients: string[];
  template: string; category: string;
  lastFired?: string; nextFire?: string;
}
interface NotifLog {
  id: string; ruleId: string; ruleName: string;
  channel: NotifChannel; recipient: string;
  message: string; status: NotifStatus;
  sentAt: string; readAt?: string;
}

const CHANNEL_CFG: Record<NotifChannel,{label:string;icon:React.ReactNode;cls:string;dot:string}> = {
  zalo:  { label:'Zalo OA',    icon:<MessageSquare size={13}/>, cls:'bg-teal-100 text-teal-700',   dot:'bg-teal-500'   },
  email: { label:'Email',      icon:<Mail size={13}/>,          cls:'bg-blue-100 text-blue-700',   dot:'bg-blue-500'   },
  inapp: { label:'In-App',     icon:<Bell size={13}/>,          cls:'bg-violet-100 text-violet-700',dot:'bg-violet-500' },
};
const STATUS_CFG: Record<NotifStatus,{label:string;cls:string}> = {
  sent:      { label:'Đã gửi',    cls:'bg-emerald-100 text-emerald-700' },
  pending:   { label:'Đang gửi',  cls:'bg-amber-100 text-amber-700'    },
  failed:    { label:'Thất bại',  cls:'bg-rose-100 text-rose-700'      },
  scheduled: { label:'Đã lên lịch',cls:'bg-blue-100 text-blue-700'    },
};
const TRIG_CFG: Record<TriggerType,{label:string;cls:string;icon:React.ReactNode}> = {
  deadline:  { label:'Sắp đến hạn',    cls:'bg-rose-100 text-rose-700',   icon:<Clock size={12}/>       },
  threshold: { label:'Vượt ngưỡng',    cls:'bg-amber-100 text-amber-700', icon:<AlertTriangle size={12}/> },
  schedule:  { label:'Định kỳ',        cls:'bg-blue-100 text-blue-700',   icon:<Calendar size={12}/>    },
  event:     { label:'Sự kiện',        cls:'bg-violet-100 text-violet-700',icon:<Zap size={12}/>        },
};
const CAT_ICON: Record<string,React.ReactNode> = {
  'Hợp đồng':   <FileText size={14} className="text-indigo-500"/>,
  'Tiến độ':    <Flag size={14} className="text-emerald-500"/>,
  'An toàn':    <HardHat size={14} className="text-amber-500"/>,
  'Tài chính':  <DollarSign size={14} className="text-teal-500"/>,
  'Nhân sự':    <Users size={14} className="text-blue-500"/>,
  'Chất lượng': <CheckSquare size={14} className="text-rose-500"/>,
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const INIT_RULES: NotifRule[] = [
  { id:'r1', name:'Cảnh báo bảo lãnh sắp hết hạn', active:true, trigger:'deadline', triggerDesc:'30 ngày trước ngày hết hạn bảo lãnh hợp đồng', channels:['zalo','email'], recipients:['GĐ DA','Kế toán KTT'], template:'Bảo lãnh {contract_name} sẽ hết hạn vào {deadline}. Cần gia hạn hoặc xử lý trước {deadline-7}.', category:'Hợp đồng', lastFired:'15/02/2026', nextFire:'08/04/2026' },
  { id:'r2', name:'Nhắc hạn thanh toán đến kỳ', active:true, trigger:'deadline', triggerDesc:'7 ngày trước ngày đến hạn thanh toán theo HĐ', channels:['zalo','inapp'], recipients:['GĐ DA','QS Minh Tuấn'], template:'Thanh toán đợt {period} ({amount} tỷ) đến hạn ngày {deadline}. Hồ sơ đã đủ chưa?', category:'Tài chính', nextFire:'15/03/2026' },
  { id:'r3', name:'Cảnh báo tiến độ chậm (SPI<0.85)', active:true, trigger:'threshold', triggerDesc:'Khi SPI < 0.85 trong 2 tuần liên tiếp', channels:['zalo','email'], recipients:['GĐ DA','CHT Nguyễn Văn Anh'], template:'⚠ Cảnh báo tiến độ: SPI = {spi} — Dự án {project_name} đang chậm tiến độ nghiêm trọng. Cần họp khẩn trước {deadline}.', category:'Tiến độ', lastFired:'01/03/2026' },
  { id:'r4', name:'Báo cáo tiến độ tuần tự động', active:true, trigger:'schedule', triggerDesc:'Thứ Hai hàng tuần lúc 07:30', channels:['email'], recipients:['GĐ DA','Ban QLDA'], template:'Báo cáo tiến độ tuần {week_no}: Tiến độ {progress}%, SPI={spi}, CPI={cpi}. Chi tiết xem tại hệ thống.', category:'Tiến độ', lastFired:'03/03/2026', nextFire:'10/03/2026' },
  { id:'r5', name:'Cảnh báo tai nạn lao động', active:true, trigger:'event', triggerDesc:'Ngay khi ghi nhận sự cố mức độ 2 trở lên trong HSE', channels:['zalo','email','inapp'], recipients:['GĐ DA','HSE Officer','CHT'], template:'🚨 TAI NẠN LAO ĐỘNG: {incident_desc}. Địa điểm: {location}. Thời gian: {time}. Cần xử lý khẩn cấp!', category:'An toàn', lastFired:'22/02/2026' },
  { id:'r6', name:'Nhắc checklist QA/QC hàng ngày', active:false, trigger:'schedule', triggerDesc:'Hàng ngày lúc 08:00 cho KS Giám sát', channels:['inapp'], recipients:['KS Giám sát Hoàng','QC Thảo'], template:'📋 Nhắc nhở: Chưa có checklist nghiệm thu hôm nay ({date}). Vui lòng cập nhật.', category:'Chất lượng', nextFire:'08/03/2026' },
  { id:'r7', name:'Cảnh báo hợp đồng LĐ sắp hết hạn', active:true, trigger:'deadline', triggerDesc:'30 ngày trước ngày hết hạn hợp đồng lao động', channels:['email','inapp'], recipients:['HR Nguyễn Minh'], template:'HĐ lao động của {employee_name} (Vị trí: {position}) hết hạn ngày {deadline}. Cần gia hạn hoặc thanh lý.', category:'Nhân sự', nextFire:'20/03/2026' },
];
const INIT_LOGS: NotifLog[] = [
  { id:'l1', ruleId:'r3', ruleName:'Cảnh báo tiến độ chậm', channel:'zalo', recipient:'GĐ DA', message:'⚠ Cảnh báo tiến độ: SPI = 0.745 — Dự án Villa PAT đang chậm tiến độ nghiêm trọng. Cần họp khẩn trước 05/03/2026.', status:'sent', sentAt:'01/03/2026 08:15', readAt:'01/03/2026 08:47' },
  { id:'l2', ruleId:'r3', ruleName:'Cảnh báo tiến độ chậm', channel:'email', recipient:'CHT Nguyễn Văn Anh', message:'⚠ Cảnh báo tiến độ: SPI = 0.745 — Dự án Villa PAT đang chậm tiến độ nghiêm trọng.', status:'sent', sentAt:'01/03/2026 08:15', readAt:'01/03/2026 09:22' },
  { id:'l3', ruleId:'r4', ruleName:'Báo cáo tiến độ tuần tự động', channel:'email', recipient:'GĐ DA', message:'Báo cáo tiến độ tuần 9: Tiến độ 45.5%, SPI=0.745, CPI=0.730.', status:'sent', sentAt:'03/03/2026 07:30' },
  { id:'l4', ruleId:'r5', ruleName:'Cảnh báo tai nạn lao động', channel:'zalo', recipient:'GĐ DA', message:'🚨 TAI NẠN LAO ĐỘNG: Té ngã từ tầng 2. Địa điểm: Block A tầng 2. Thời gian: 22/02/2026 14:30.', status:'sent', sentAt:'22/02/2026 14:35', readAt:'22/02/2026 14:40' },
  { id:'l5', ruleId:'r2', ruleName:'Nhắc hạn thanh toán', channel:'inapp', recipient:'QS Minh Tuấn', message:'Thanh toán đợt 3 (5.2 tỷ) đến hạn ngày 15/03/2026. Hồ sơ đã đủ chưa?', status:'scheduled', sentAt:'08/03/2026 09:00' },
];

const GEM_NOTIF_SYS = `Bạn là GEM — chuyên gia truyền thông dự án xây dựng. Xưng "em", gọi "Anh/Chị". Soạn thông báo chuyên nghiệp, ngắn gọn, rõ ràng, phù hợp từng kênh giao tiếp.`;

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300";

// ─── Global Notification Context ─────────────────────────────────────────────
// Dùng cho mọi module từ S11 trở đi — thay thế local useState toast riêng lẻ

export type ToastType = 'ok' | 'err' | 'warn' | 'info';

export interface ToastItem {
  id:      string;
  type:    ToastType;
  msg:     string;
  detail?: string;
}

interface NotifCtx {
  toasts:    ToastItem[];
  unreadCount: number;
  toast:     (msg: string, type?: ToastType, detail?: string) => void;
  ok:        (msg: string, detail?: string) => void;
  err:       (msg: string, detail?: string) => void;
  warn:      (msg: string, detail?: string) => void;
  info:      (msg: string, detail?: string) => void;
  dismiss:   (id: string) => void;
  incrementUnread: () => void;
  clearUnread: () => void;
}

const NotificationContext = createContext<NotifCtx>({
  toasts: [], unreadCount: 0,
  toast: () => {}, ok: () => {}, err: () => {}, warn: () => {}, info: () => {},
  dismiss: () => {}, incrementUnread: () => {}, clearUnread: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts]           = useState<ToastItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const timerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts(p => p.filter(t => t.id !== id));
    if (timerRef.current[id]) clearTimeout(timerRef.current[id]);
  }, []);

  const toast = useCallback((msg: string, type: ToastType = 'info', detail?: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    setToasts(p => [...p.slice(-4), { id, type, msg, detail }]); // max 5 toasts
    timerRef.current[id] = setTimeout(() => dismiss(id), type === 'err' ? 6000 : 3500);
  }, [dismiss]);

  const ok   = useCallback((m: string, d?: string) => toast(m, 'ok',   d), [toast]);
  const err  = useCallback((m: string, d?: string) => toast(m, 'err',  d), [toast]);
  const warn = useCallback((m: string, d?: string) => toast(m, 'warn', d), [toast]);
  const info = useCallback((m: string, d?: string) => toast(m, 'info', d), [toast]);
  const incrementUnread = useCallback(() => setUnreadCount(n => n + 1), []);
  const clearUnread     = useCallback(() => setUnreadCount(0), []);

  return (
    <NotificationContext.Provider value={{
      toasts, unreadCount, toast, ok, err, warn, info,
      dismiss, incrementUnread, clearUnread,
    }}>
      {children}
      <InAppToastStack />
    </NotificationContext.Provider>
  );
}

/** Hook — dùng trong mọi module: const { ok, err, warn } = useNotification() */
export function useNotification() {
  return useContext(NotificationContext);
}

// ─── Toast UI — tự render qua Provider, không cần thêm vào từng component ─────
const TOAST_STYLE: Record<ToastType, { bar: string; icon: string; text: string }> = {
  ok:   { bar: 'bg-emerald-500', icon: '✅', text: 'text-emerald-800' },
  err:  { bar: 'bg-rose-500',    icon: '❌', text: 'text-rose-800'    },
  warn: { bar: 'bg-amber-500',   icon: '⚠️', text: 'text-amber-800'   },
  info: { bar: 'bg-blue-500',    icon: 'ℹ️', text: 'text-blue-800'    },
};

function InAppToastStack() {
  const { toasts, dismiss } = useContext(NotificationContext);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-24 right-4 md:bottom-4 md:right-4 z-[9999] flex flex-col gap-2 max-w-[calc(100vw-32px)] md:max-w-xs w-full pointer-events-none">
      {toasts.map(t => {
        const s = TOAST_STYLE[t.type];
        return (
          <div key={t.id}
            className="pointer-events-auto flex items-start gap-2 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-fade-in"
          >
            <div className={`w-1 self-stretch flex-shrink-0 ${s.bar}`} />
            <div className="flex-1 py-2.5 pr-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${s.text}`}>
                {s.icon} {t.msg}
              </p>
              {t.detail && (
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{t.detail}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="p-2 text-slate-400 hover:text-slate-600 flex-shrink-0 self-start mt-1"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NotificationEngine({ project }: Props) {
  const [tab, setTab] = useState<'rules'|'logs'|'compose'>('rules');
  const [rules, setRules] = useState<NotifRule[]>(INIT_RULES);
  const [logs, setLogs] = useState<NotifLog[]>(INIT_LOGS);
  const [expandedRule, setExpandedRule] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [gemLoading, setGemLoading] = useState(false);
  const [gemText, setGemText] = useState('');
  const [composeData, setComposeData] = useState({ to:'', channel:'zalo' as NotifChannel, subject:'', context:'' });
  const [isSending, setIsSending]     = useState(false);
  const [sendResult, setSendResult]   = useState<{success:boolean;sent:number;failed:number;errorMsg?:string}|null>(null);
  const [allUsers, setAllUsers]       = useState<{id:string;full_name:string;job_role:string}[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]); // array of user IDs

  // Load danh sách users từ Supabase profiles
  React.useEffect(() => {
    (async () => {
      const { getSupabase } = await import('./supabase');
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.from('profiles').select('id,full_name,job_role').order('full_name');
      if (data) setAllUsers(data);
    })();
  }, []);

  const toggleUser = (uid: string) => setSelectedUsers(prev =>
    prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
  );
  const selectAll = () => setSelectedUsers(allUsers.map(u => u.id));
  const clearAll  = () => setSelectedUsers([]);

  const { ok: notifOk, err: notifErr, info: notifInfo } = useNotification();
  const toggleRule = (id: string) => setRules(p => p.map(r => r.id===id ? {...r, active:!r.active} : r));

  const sendMessage = useCallback(async () => {
    const needsTo = composeData.channel !== 'inapp';
    if (!gemText || (needsTo && !composeData.to)) return;
    setIsSending(true); setSendResult(null);
    let sent = 0; let failed = 0;

    try {
      if (composeData.channel === 'zalo') {
        // ── Zalo OA ──────────────────────────────────────────────────────────
        if (!ZaloService.isEnabled()) {
          // Chưa cấu hình OA token → báo lỗi rõ ràng
          setSendResult({ success: false, sent: 0, failed: 1 });
          notifErr('Zalo OA chưa cấu hình. Kiểm tra VITE_ZALO_OA_ID trong .env');
          setIsSending(false); return;
        }
        const recipients: ZaloRecipient[] = composeData.to.split(',').map(name => ({ name: name.trim() }));
        const result = await ZaloService.sendAlert({
          title: 'Thông báo từ GEM PM Pro',
          body:  gemText,
          recipients,
          emoji: '📢',
        });
        sent   = result.sent;
        failed = result.failed;

      } else if (composeData.channel === 'email') {
        // ── Email qua Supabase Edge Function (send-email) ────────────────────
        const { getSupabase } = await import('./supabase');
        const sb = getSupabase();
        if (!sb) { failed = 1; throw new Error('Không kết nối được Supabase'); }
        const toAddresses = composeData.to.split(',').map(s => s.trim()).filter(Boolean);
        const { error } = await sb.functions.invoke('send-email', {
          body: {
            to:      toAddresses,
            subject: composeData.subject || 'Thông báo từ GEM PM Pro',
            html:    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                        <h2 style="color:#1a8a7a">GEM & CLAUDE PM Pro</h2>
                        <p>${gemText.replace(/\n/g, '<br/>')}</p>
                        <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
                        <p style="color:#999;font-size:12px">Thông báo tự động từ GEM PM Pro · gemclaudepm.com</p>
                      </div>`,
            text:    gemText,
          },
        });
        if (error) { failed = toAddresses.length; throw error; }
        sent = toAddresses.length;

      } else if (composeData.channel === 'inapp') {
        // ── In-App: lưu vào Supabase inapp_notifications cho từng recipient ──
        const plainText = gemText
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/_(.*?)_/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .trim();

        const targets = selectedUsers.length > 0 ? selectedUsers : allUsers.map(u => u.id);
        if (targets.length === 0) throw new Error('Không có người nhận — danh sách user trống');

        const { getSupabase } = await import('./supabase');
        const sb = getSupabase();
        if (!sb) throw new Error('Không kết nối được Supabase');

        const rows = targets.map(uid => ({
          recipient_id: uid,
          message:      plainText,
          title:        composeData.subject || 'Thông báo từ GEM PM Pro',
          category:     'general',
        }));

        const { error: insErr } = await sb.from('inapp_notifications').insert(rows);
        if (insErr) throw new Error(insErr.message);

        // Toast cho chính người gửi
        notifInfo(`Đã gửi In-App cho ${targets.length} người`);
        sent = targets.length;

        // Lưu log
        const newLog: NotifLog = {
          id:       `l${Date.now()}`,
          ruleId:   'manual',
          ruleName: 'Gửi thủ công',
          channel:  'inapp',
          recipient: targets.length === allUsers.length ? '@All' : `${targets.length} người`,
          message:  plainText,
          status:   'sent',
          sentAt:   new Date().toLocaleString('vi-VN'),
        };
        setLogs(prev => [newLog, ...prev]);
      }

      setSendResult({ success: failed === 0, sent, failed });
      if (sent > 0) {
        notifOk(`Đã gửi ${sent} thông báo qua ${CHANNEL_CFG[composeData.channel].label}`);
        // Lưu log
        const newLog: NotifLog = {
          id:       `l${Date.now()}`,
          ruleId:   'manual',
          ruleName: 'Gửi thủ công',
          channel:  composeData.channel,
          recipient: composeData.to,
          message:  gemText,
          status:   'sent',
          sentAt:   new Date().toLocaleString('vi-VN'),
        };
        if (composeData.channel !== 'inapp') setLogs(prev => [newLog, ...prev]);
      }
    } catch (e: any) {
      const errorMsg = e?.message ?? e?.error_description ?? JSON.stringify(e) ?? 'Lỗi không xác định';
      setSendResult({ success: false, sent, failed: failed || 1, errorMsg });
      notifErr(`Gửi thất bại: ${errorMsg}`);
    }
    setIsSending(false);
  }, [gemText, composeData, notifOk, notifErr, notifInfo]);

  const sendCount = logs.filter(l=>l.status==='sent').length;
  const activeRules = rules.filter(r=>r.active).length;
  const unread = logs.filter(l=>l.status==='sent'&&!l.readAt).length;

  const composeWithGEM = useCallback(async () => {
    if (!composeData.context) return;
    setGemLoading(true); setGemText('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY, systemInstruction: GEM_NOTIF_SYS });
      const chanLabel = CHANNEL_CFG[composeData.channel].label;
      const r = await model.generateContent(
        `Soạn thông báo ${chanLabel} cho dự án xây dựng:\n` +
        `Gửi đến: ${composeData.to || '[Người nhận]'}\n` +
        `Tiêu đề: ${composeData.subject || '[Tự động]'}\n` +
        `Nội dung cần truyền đạt: ${composeData.context}\n\n` +
        `Yêu cầu: Soạn thông báo phù hợp kênh ${chanLabel}. ${composeData.channel==='zalo'?'Zalo: ngắn gọn, emoji phù hợp, không quá 300 ký tự.':composeData.channel==='email'?'Email: có tiêu đề rõ, nội dung đầy đủ, lịch sự.':'In-App: cực ngắn, dưới 100 ký tự.'}`
      );
      setGemText(r.response.text());
    } catch { setGemText('❌ Không kết nối GEM.'); }
    setGemLoading(false);
  }, [composeData]);

  const tabs = [
    { id:'rules'   as const, label:'Quy tắc cảnh báo', icon:<Settings size={14}/>     },
    { id:'logs'    as const, label:'Lịch sử gửi',       icon:<Bell size={14}/>         },
    { id:'compose' as const, label:'Soạn thông báo',    icon:<Send size={14}/>         },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Bell size={20} className="text-violet-600"/>
          Notification Engine — {project?.name||'Dự án'}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Cảnh báo tự động · Zalo OA · Email · Thông báo In-App</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Quy tắc hoạt động', val:activeRules, sub:`/${rules.length} quy tắc`, cls:'bg-violet-100 text-violet-700' },
          { label:'Đã gửi hôm nay',    val:sendCount,   sub:'thông báo',              cls:'bg-emerald-100 text-emerald-700' },
          { label:'Chưa đọc',          val:unread,      sub:'thông báo',              cls:unread>0?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600' },
          { label:'Gửi lỗi',           val:logs.filter(l=>l.status==='failed').length, sub:'thông báo', cls:'bg-rose-100 text-rose-700' },
        ].map((k,i)=>(
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><Bell size={16}/></div>
            <div className="text-2xl font-bold text-slate-800">{k.val}</div>
            <div className="text-xs text-slate-400 mt-0.5">{k.label}</div>
            <div className="text-[10px] text-slate-400">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs — underline style */}
      <div className="flex border-b border-slate-200">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${tab===t.id?'border-violet-600 text-violet-700':'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Rules tab ──────────────────────────────────────────────────────── */}
      {tab==='rules' && (
        <div className="space-y-3">
          {/* Channel status */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wide">Trạng thái kênh gửi</p>
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(CHANNEL_CFG) as [NotifChannel, typeof CHANNEL_CFG[NotifChannel]][]).map(([k,v])=>(
                <div key={k} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${v.cls} border-current/20`}>
                  {v.icon}<span>{v.label}</span>
                  {k==='zalo' && <span className={`w-1.5 h-1.5 rounded-full ${v.dot} animate-pulse`}/>}
                </div>
              ))}
            </div>
          </div>



          {rules.map(rule=>{
            const trig = TRIG_CFG[rule.trigger];
            const isExp = expandedRule===rule.id;
            return (
              <div key={rule.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${rule.active?'border-slate-200':'border-slate-100 opacity-60'}`}>
                <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50" onClick={()=>setExpandedRule(isExp?null:rule.id)}>
                  <button onClick={e=>{e.stopPropagation();toggleRule(rule.id);}}
                    className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${rule.active?'bg-violet-600':'bg-slate-200'}`}>
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${rule.active?'translate-x-5':'translate-x-0'}`}/>
                  </button>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${rule.active?'bg-violet-100':'bg-slate-100'}`}>
                    {CAT_ICON[rule.category]||<Bell size={14} className="text-slate-400"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-bold text-slate-800">{rule.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trig.cls}`}>{trig.label}</span>
                      <span className="text-[10px] text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">{rule.category}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{rule.triggerDesc}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {rule.channels.map(ch=>(
                        <span key={ch} className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${CHANNEL_CFG[ch].cls}`}>
                          {CHANNEL_CFG[ch].icon}{CHANNEL_CFG[ch].label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0 mr-2">
                    {rule.nextFire&&<p className="text-[10px] text-blue-600 font-semibold">Tiếp: {rule.nextFire}</p>}
                    {rule.lastFired&&<p className="text-[10px] text-slate-400">Gửi lần cuối: {rule.lastFired}</p>}
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isExp?'rotate-180':''}`}/>
                </div>
                {isExp && (
                  <div className="border-t border-slate-100 p-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wide">Template thông báo</p>
                      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 font-mono leading-relaxed">{rule.template}</div>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-600 flex-wrap">
                      <div><span className="font-bold text-slate-400">Người nhận: </span>{rule.recipients.join(' · ')}</div>
                    </div>
                    <div className="flex gap-3">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors"><Send size={13}/>Gửi test</button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"><Edit3 size={13}/>Sửa</button>
                      <button onClick={()=>setRules(p=>p.filter(r=>r.id!==rule.id))} className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 border border-rose-200 rounded-lg text-xs font-medium hover:bg-rose-50 transition-colors"><Trash2 size={13}/>Xóa</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Dashed add button — cuối list */}
          <button onClick={()=>setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 transition-all">
            <Plus size={14}/> Thêm quy tắc mới
          </button>
        </div>
      )}

      {/* ── Logs tab ───────────────────────────────────────────────────────── */}
      {tab==='logs' && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-slate-500">Tổng {logs.length} thông báo</span>
            <button className="flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"><RefreshCw size={13}/>Làm mới</button>
          </div>
          {logs.map(log=>{
            const ch = CHANNEL_CFG[log.channel]; const st = STATUS_CFG[log.status];
            return (
              <div key={log.id} className={`bg-white border rounded-2xl shadow-sm p-4 ${log.status==='failed'?'border-rose-200':'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ch.cls}`}>{ch.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-slate-700">{log.ruleName}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ch.cls}`}>{ch.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{log.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-slate-400">
                      <span>→ {log.recipient}</span>
                      <span>{log.sentAt}</span>
                      {log.readAt&&<span className="text-emerald-500 font-semibold">✓ Đã đọc {log.readAt}</span>}
                      {log.status==='sent'&&!log.readAt&&<span className="text-amber-500">Chưa đọc</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Compose tab ────────────────────────────────────────────────────── */}
      {tab==='compose' && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Send size={15} className="text-violet-600"/>Soạn thông báo</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block tracking-wide">Kênh gửi</label>
                <div className="flex gap-2">
                  {(Object.keys(CHANNEL_CFG) as NotifChannel[]).map(ch=>(
                    <button key={ch} onClick={()=>setComposeData(p=>({...p,channel:ch}))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all ${composeData.channel===ch?`${CHANNEL_CFG[ch].cls} border-current/40`:'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {CHANNEL_CFG[ch].icon}{CHANNEL_CFG[ch].label}
                    </button>
                  ))}
                </div>
              </div>
              {composeData.channel !== 'inapp' ? (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block tracking-wide">Gửi đến</label>
                  <input value={composeData.to} onChange={e=>setComposeData(p=>({...p,to:e.target.value}))} placeholder="GĐ DA, CHT, Kế toán..." className={inputCls}/>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Người nhận In-App</label>
                    <div className="flex gap-2">
                      <button onClick={selectAll} className="text-[10px] text-violet-600 font-bold hover:underline">Chọn tất cả ({allUsers.length})</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={clearAll} className="text-[10px] text-slate-400 font-bold hover:underline">Bỏ chọn</button>
                    </div>
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {allUsers.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-slate-400 text-center">Đang tải danh sách user...</div>
                    ) : allUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={selectedUsers.includes(u.id)}
                          onChange={()=>toggleUser(u.id)}
                          className="w-3.5 h-3.5 accent-violet-600"/>
                        <span className="text-xs font-semibold text-slate-700 flex-1">{u.full_name}</span>
                        <span className="text-[10px] text-slate-400">{u.job_role}</span>
                      </label>
                    ))}
                  </div>
                  {selectedUsers.length > 0 && (
                    <p className="text-[10px] text-violet-600 font-semibold mt-1.5">
                      Đã chọn {selectedUsers.length}/{allUsers.length} người nhận
                    </p>
                  )}
                  {allUsers.length > 0 && selectedUsers.length === 0 && (
                    <p className="text-[10px] text-amber-500 font-semibold mt-1.5">
                      Chưa chọn ai — sẽ gửi cho tất cả {allUsers.length} user
                    </p>
                  )}
                </div>
              )}
              {composeData.channel==='email'&&(
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block tracking-wide">Tiêu đề email</label>
                  <input value={composeData.subject} onChange={e=>setComposeData(p=>({...p,subject:e.target.value}))} placeholder="VD: [Villa PAT] Cảnh báo tiến độ tuần 10" className={inputCls}/>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block tracking-wide">Nội dung cần truyền đạt</label>
                <textarea rows={4} value={composeData.context} onChange={e=>setComposeData(p=>({...p,context:e.target.value}))} placeholder="Mô tả nội dung bạn muốn thông báo, GEM sẽ soạn thảo phù hợp..." className={inputCls+" resize-none"}/>
              </div>
              <button onClick={composeWithGEM} disabled={gemLoading||!composeData.context}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60">
                {gemLoading?<><Loader2 size={14} className="animate-spin"/>Đang soạn...</>:<><Sparkles size={14}/>GEM soạn thông báo</>}
              </button>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Eye size={15} className="text-slate-500"/>Xem trước</h3>
              {gemText&&(
                <button onClick={sendMessage} disabled={isSending||(composeData.channel!=='inapp'&&!composeData.to)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
                  {isSending?<Loader2 size={10} className="animate-spin"/>:<Send size={10}/>}
                  {isSending?'Đang gửi...':'Gửi ngay'}
                </button>
              )}
            </div>
            <div className={`flex-1 min-h-48 rounded-xl border p-4 ${composeData.channel==='zalo'?'bg-teal-50 border-teal-200':composeData.channel==='email'?'bg-blue-50 border-blue-200':'bg-violet-50 border-violet-200'}`}>
              {!gemText&&!gemLoading&&(
                <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
                  {CHANNEL_CFG[composeData.channel].icon}
                  <p className="text-xs text-slate-400">Preview {CHANNEL_CFG[composeData.channel].label} xuất hiện ở đây</p>
                </div>
              )}
              {gemLoading&&<div className="flex items-center gap-2 text-slate-400"><Loader2 size={14} className="animate-spin"/>Đang soạn...</div>}
              {gemText&&<pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{gemText}</pre>}
              {sendResult&&(
                <div className={`mt-3 p-2.5 rounded-xl text-xs font-semibold ${sendResult.success?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}`}>
                  <div className="flex items-center gap-2">
                    {sendResult.success?<CheckCircle2 size={13}/>:<AlertTriangle size={13}/>}
                    {sendResult.success?`Đã gửi ${sendResult.sent} người thành công`:`Gửi thất bại`}
                  </div>
                  {sendResult.errorMsg&&(
                    <p className="mt-1 text-[11px] font-normal opacity-80 break-all">{sendResult.errorMsg}</p>
                  )}
                </div>
              )}
            </div>
            {gemText&&(
              <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl ${CHANNEL_CFG[composeData.channel].cls} text-[11px] font-semibold`}>
                {CHANNEL_CFG[composeData.channel].icon}
                {composeData.channel==='zalo'?`${gemText.length} ký tự — phù hợp Zalo`:composeData.channel==='email'?'Đủ chuẩn Email formal':'Thông báo In-App'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add rule modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Bell size={16} className="text-violet-600"/>Thêm quy tắc cảnh báo</h3>
              <button onClick={()=>setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
            </div>
            <p className="text-sm text-slate-500 text-center py-8">Form tạo quy tắc mới — coming soon ✨</p>
            <button onClick={()=>setShowForm(false)} className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}
