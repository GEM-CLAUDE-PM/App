/**
 * ZaloSetupPanel.tsx — GEM&CLAUDE PM Pro
 * Panel cấu hình và test Zalo OA Integration.
 * Hiển thị trong tab Settings hoặc NotificationEngine.
 */

import React, { useState, useEffect } from 'react';
import { ZaloService } from './ZaloService';
import {
  MessageSquare, CheckCircle2, AlertTriangle, Loader2,
  Copy, ExternalLink, Key, Send, Users, RefreshCw,
  Info, Zap, Settings, Eye, EyeOff, ChevronRight,
} from 'lucide-react';

const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white';

export default function ZaloSetupPanel() {
  const [status, setStatus]       = useState<{ configured: boolean; has_token: boolean; app_id: string } | null>(null);
  const [loading, setLoading]     = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg]     = useState('🧪 Test từ GEM PM Pro — Zalo OA đã kết nối thành công!');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isEnabled = ZaloService.isEnabled();

  useEffect(() => {
    if (!isEnabled) return;
    fetch('/api/zalo/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [isEnabled]);

  const sendTest = async () => {
    if (!testPhone) return;
    setLoading(true); setTestResult(null);
    const result = await ZaloService.send({
      type: 'direct',
      recipients: [{ name: 'Test', phone: ZaloService.formatPhone(testPhone) }],
      text: testMsg,
    });
    setTestResult(result.success ? '✅ Gửi thành công!' : `❌ Thất bại: ${result.results[0]?.error}`);
    setLoading(false);
  };

  const refreshToken = async () => {
    setRefreshing(true);
    try {
      const r = await fetch('/api/zalo/refresh-token', { method: 'POST' });
      const d = await r.json();
      setTestResult(d.success ? '✅ Token đã được refresh!' : `❌ ${d.error}`);
    } catch { setTestResult('❌ Lỗi kết nối server'); }
    setRefreshing(false);
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl text-white">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
          <MessageSquare size={22}/>
        </div>
        <div>
          <h3 className="font-bold text-lg">Zalo OA Integration</h3>
          <p className="text-teal-100 text-sm">Gửi thông báo trực tiếp qua Zalo Official Account</p>
        </div>
        <span className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-bold shrink-0
          ${isEnabled ? 'bg-white/20 text-white' : 'bg-white/10 text-teal-200'}`}>
          {isEnabled ? '⚡ Đã cấu hình' : '⚙️ Chưa cấu hình'}
        </span>
      </div>

      {/* Status */}
      {isEnabled && status && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'OA Secret',     ok: status.configured, tip: 'ZALO_OA_SECRET trong .env server' },
            { label: 'Access Token',  ok: status.has_token,  tip: 'ZALO_OA_ACCESS_TOKEN (3 tháng/lần)' },
            { label: 'App ID',        ok: !!status.app_id && status.app_id !== '(chưa cấu hình)', tip: status.app_id },
          ].map((s, i) => (
            <div key={i} className={`p-3 rounded-xl border text-center ${s.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              {s.ok ? <CheckCircle2 size={16} className="text-emerald-600 mx-auto mb-1"/> : <AlertTriangle size={16} className="text-rose-500 mx-auto mb-1"/>}
              <p className="text-xs font-bold text-slate-700">{s.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{s.tip}</p>
            </div>
          ))}
        </div>
      )}

      {/* Setup guide (khi chưa cấu hình) */}
      {!isEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-3">
            <Info size={16}/> Hướng dẫn cấu hình Zalo OA
          </h4>
          <ol className="space-y-3">
            {[
              { step: '1', text: 'Đăng ký Zalo Official Account tại oa.zalo.me', link: 'https://oa.zalo.me', linkText: 'Mở Zalo OA →' },
              { step: '2', text: 'Vào Zalo Developer Console → Tạo ứng dụng → Lấy App ID và Secret' },
              { step: '3', text: 'Thêm vào file .env (server-side):\nVITE_ZALO_OA_ID=your_app_id\nZALO_OA_SECRET=your_secret\nZALO_OA_ACCESS_TOKEN=your_token' },
              { step: '4', text: 'Thêm vào server.ts:\nimport zaloRouter from \'./zaloRouter\';\napp.use(\'/api/zalo\', zaloRouter);' },
              { step: '5', text: 'Người dùng cần follow OA để nhận direct message (hoặc dùng ZNS cho số điện thoại)' },
            ].map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 bg-amber-200 text-amber-800 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">{item.step}</span>
                <div className="flex-1">
                  <pre className="text-xs text-amber-900 whitespace-pre-wrap font-sans leading-relaxed">{item.text}</pre>
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-teal-600 font-semibold hover:underline mt-1">
                      {item.linkText}<ExternalLink size={10}/>
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Test panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h4 className="font-bold text-slate-800 flex items-center gap-2">
          <Send size={15} className="text-teal-600"/> Gửi tin nhắn test
          {!isEnabled && <span className="text-xs font-normal text-slate-400">(Dev mode — không gửi thật)</span>}
        </h4>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số điện thoại nhận (VN)</label>
          <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
            placeholder="0901234567" className={inputCls}/>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nội dung test</label>
          <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)}
            rows={3} className={inputCls + ' resize-none'}/>
          <p className="text-[10px] text-slate-400 mt-1">{testMsg.length}/300 ký tự</p>
        </div>

        {testResult && (
          <div className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2
            ${testResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {testResult}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={sendTest} disabled={loading || !testPhone}
            className="flex-1 flex items-center justify-center gap-2 py-2.5
              bg-teal-600 hover:bg-teal-700 disabled:opacity-50
              text-white rounded-xl text-sm font-bold transition-colors">
            {loading ? <><Loader2 size={14} className="animate-spin"/>Đang gửi...</> : <><Send size={14}/>Gửi test</>}
          </button>
          {isEnabled && (
            <button onClick={refreshToken} disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5
                bg-slate-100 hover:bg-slate-200 text-slate-700
                rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}/>
              Refresh Token
            </button>
          )}
        </div>
      </div>

      {/* Supported features */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
          <Zap size={14} className="text-amber-500"/> Tính năng hỗ trợ
        </h4>
        <div className="space-y-2">
          {[
            { icon: '🚨', title: 'Cảnh báo HSE khẩn',         desc: 'Gửi ngay khi ghi nhận sự cố mức 2+' },
            { icon: '💰', title: 'Nhắc thanh toán',            desc: 'Tự động 7 ngày trước hạn' },
            { icon: '📅', title: 'Nhắc lịch họp',              desc: '1 giờ trước giờ họp' },
            { icon: '⚠️', title: 'Cảnh báo tiến độ (SPI<0.85)', desc: 'Hàng tuần nếu SPI dưới ngưỡng' },
            { icon: '📋', title: 'Thông báo soạn bởi GEM AI',  desc: 'Compose tab + Gửi ngay qua Zalo' },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 hover:bg-slate-50 rounded-xl">
              <span className="text-lg shrink-0">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">{f.title}</p>
                <p className="text-xs text-slate-400">{f.desc}</p>
              </div>
              <ChevronRight size={13} className="text-slate-300 ml-auto shrink-0 mt-0.5"/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
