/**
 * BillingPage.tsx — GEM & CLAUDE PM Pro
 * S17 — 3 gói dịch vụ: Starter / Pro / Enterprise
 * VNPay mock integration + trial 14 ngày + invoice tự động
 */
import React, { useState } from 'react';
import { useNotification } from './NotificationEngine';
import ModalForm, { FormRow, FormGrid, inputCls, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import {
  Check, X, Zap, Shield, Crown, CreditCard,
  Calendar, Download, AlertTriangle, ChevronDown, ChevronUp,
  Building2, Users, HardDrive, Lock, Star,
} from 'lucide-react';

type Plan = 'starter' | 'pro' | 'enterprise';
type BillingCycle = 'monthly' | 'yearly';

interface PlanConfig {
  id: Plan;
  name: string;
  badge?: string;
  price: { monthly: number; yearly: number };
  users: string;
  projects: string;
  storage: string;
  color: string;
  icon: React.ReactNode;
  features: string[];
  limitations?: string[];
  cta: string;
}

const PLANS: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: { monthly: 990_000, yearly: 9_900_000 },
    users: '≤ 10 người dùng',
    projects: '3 dự án',
    storage: '5 GB',
    color: 'slate',
    icon: <Zap size={20}/>,
    features: [
      'Tiến độ & Gantt cơ bản',
      'Vật tư & Kho',
      'QA/QC & Nghiệm thu',
      'HSE cơ bản',
      'Xuất báo cáo PDF',
      'GEM AI (50 phân tích/tháng)',
      'Hỗ trợ email',
    ],
    limitations: [
      'Không có SubconPortal',
      'Không có ClientPortal',
      'Không có Multi-tenant',
    ],
    cta: 'Dùng thử 14 ngày',
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Phổ biến nhất',
    price: { monthly: 2_490_000, yearly: 24_900_000 },
    users: 'Không giới hạn',
    projects: 'Không giới hạn',
    storage: '50 GB',
    color: 'emerald',
    icon: <Shield size={20}/>,
    features: [
      'Tất cả tính năng Starter',
      'SubconPortal — NTP login riêng',
      'ClientPortal — CĐT xem read-only',
      'Risk Dashboard & EWI',
      'BOQ / QS / Accounting đầy đủ',
      'GEM AI không giới hạn',
      'Zalo OA notification',
      'Export Excel + PDF nâng cao',
      'Hỗ trợ ưu tiên (chat + call)',
    ],
    cta: 'Dùng thử 14 ngày',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: { monthly: 0, yearly: 0 },
    users: '50+ người dùng',
    projects: 'Không giới hạn',
    storage: 'Không giới hạn',
    color: 'violet',
    icon: <Crown size={20}/>,
    features: [
      'Tất cả tính năng Pro',
      'Server riêng hoàn toàn (Single-tenant)',
      'Data isolated 100% — GEM&CLAUDE host hộ',
      'Tự quản lý user trong app — không cần IT',
      'SLA cam kết 99.9% uptime',
      'Audit log đầy đủ',
      'Custom branding',
      'Xuất toàn bộ data khi ngừng HĐ',
      'Dedicated Account Manager',
      'Onboarding tận nơi',
    ],
    cta: 'Liên hệ tư vấn',
  },
];

const FAQ = [
  { q: 'Dữ liệu của tôi được lưu ở đâu?', a: 'Starter/Pro: Server chung tại Singapore (Supabase), mã hóa AES-256, RLS tuyệt đối — không ai xem được data của bạn. Enterprise: Server Supabase riêng, GEM&CLAUDE host hộ, data isolated 100%.' },
  { q: 'Nếu tôi ngừng dùng, data có mất không?', a: 'Không. Starter/Pro: xuất CSV/Excel bất cứ lúc nào. Enterprise: GEM&CLAUDE cam kết xuất toàn bộ data dưới dạng backup ngay khi bạn yêu cầu.' },
  { q: 'Thanh toán bằng phương thức nào?', a: 'Chuyển khoản ngân hàng, VNPay (thẻ Visa/Mastercard/ATM nội địa), hoặc xuất hóa đơn VAT theo tháng/quý/năm.' },
  { q: 'Có thể nâng cấp/hạ cấp gói không?', a: 'Có. Nâng cấp có hiệu lực ngay, tính phí theo ngày còn lại. Hạ cấp có hiệu lực từ chu kỳ thanh toán tiếp theo.' },
  { q: 'Trial 14 ngày có cần thẻ tín dụng không?', a: 'Không. Đăng ký email là dùng thử ngay, không cần thông tin thanh toán. Sau 14 ngày sẽ nhận email nhắc chọn gói.' },
];

export default function BillingPage({ onClose }: { onClose?: () => void }) {
  const { ok: notifOk, info: notifInfo } = useNotification();
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const [showPayForm, setShowPayForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [payForm, setPayForm] = useState({ company: '', email: '', phone: '', method: 'vnpay' });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const yearlyDiscount = 17; // % off vs monthly×12

  const fmt = (n: number) => n === 0 ? 'Liên hệ' : `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M đ`;

  const handleSelectPlan = (plan: Plan) => {
    if (plan === 'enterprise') {
      notifInfo('Vui lòng liên hệ: gemclaudepm@gmail.com hoặc hotline để được tư vấn gói Enterprise.');
      return;
    }
    setSelectedPlan(plan);
    setShowPayForm(true);
  };

  const handleStartTrial = () => {
    if (!payForm.email?.includes('@')) { return; }
    notifOk(`🎉 Đã kích hoạt trial 14 ngày gói ${selectedPlan === 'starter' ? 'Starter' : 'Pro'}! Kiểm tra email ${payForm.email} để xác nhận.`);
    setShowPayForm(false);
    onClose?.();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-5 text-center relative">
        {onClose && (
          <button onClick={onClose} className="absolute right-4 top-4 p-2 hover:bg-slate-100 rounded-xl">
            <X size={18} className="text-slate-500"/>
          </button>
        )}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Building2 size={20} className="text-emerald-600"/>
          <span className="text-sm font-black text-slate-800">GEM & CLAUDE PM Pro</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Chọn gói phù hợp với dự án của anh</h1>
        <p className="text-slate-500 text-sm max-w-lg mx-auto">Tất cả gói đều có trial 14 ngày miễn phí. Không cần thẻ tín dụng.</p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <span className={`text-sm font-semibold ${cycle === 'monthly' ? 'text-slate-800' : 'text-slate-400'}`}>Hàng tháng</span>
          <button
            onClick={() => setCycle(c => c === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-12 h-6 rounded-full transition-colors ${cycle === 'yearly' ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cycle === 'yearly' ? 'translate-x-6' : 'translate-x-0.5'}`}/>
          </button>
          <span className={`text-sm font-semibold ${cycle === 'yearly' ? 'text-slate-800' : 'text-slate-400'}`}>
            Hàng năm
            <span className="ml-1.5 text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              -{yearlyDiscount}%
            </span>
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map(plan => {
            const price = cycle === 'yearly' ? plan.price.yearly : plan.price.monthly;
            const isPopular = plan.id === 'pro';
            return (
              <div key={plan.id} className={`bg-white rounded-2xl border-2 p-5 flex flex-col relative ${
                isPopular ? 'border-emerald-400 shadow-lg shadow-emerald-100' : 'border-slate-200'
              }`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}

                {/* Plan header */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                  plan.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                  plan.color === 'violet'  ? 'bg-violet-100 text-violet-600'  :
                                             'bg-slate-100 text-slate-600'
                }`}>{plan.icon}</div>
                <h3 className="text-lg font-black text-slate-800">{plan.name}</h3>

                {/* Price */}
                <div className="mt-3 mb-4">
                  {plan.price.monthly === 0 ? (
                    <p className="text-2xl font-black text-slate-800">Liên hệ</p>
                  ) : (
                    <>
                      <p className="text-2xl font-black text-slate-800">
                        {fmt(price)}
                        <span className="text-sm font-normal text-slate-400">/{cycle === 'yearly' ? 'năm' : 'tháng'}</span>
                      </p>
                      {cycle === 'yearly' && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          = {fmt(plan.price.yearly / 12)}/tháng · tiết kiệm {fmt(plan.price.monthly * 12 - plan.price.yearly)}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Specs */}
                <div className="space-y-1.5 mb-4 pb-4 border-b border-slate-100">
                  {[
                    [<Users size={12}/>, plan.users],
                    [<Building2 size={12}/>, `${plan.projects} dự án`],
                    [<HardDrive size={12}/>, plan.storage],
                  ].map(([icon, text], i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="text-slate-400">{icon as React.ReactNode}</span>{text as string}
                    </div>
                  ))}
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <Check size={12} className="text-emerald-500 shrink-0 mt-0.5"/>
                      {f}
                    </li>
                  ))}
                  {plan.limitations?.map((f, i) => (
                    <li key={`lim-${i}`} className="flex items-start gap-2 text-xs text-slate-400">
                      <X size={12} className="text-slate-300 shrink-0 mt-0.5"/>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isPopular
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                      : plan.id === 'enterprise'
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-slate-800 text-white hover:bg-slate-900'
                  }`}>
                  {plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon:<Shield size={16}/>, text:'Mã hóa AES-256', sub:'Data an toàn tuyệt đối' },
            { icon:<Lock size={16}/>, text:'RLS Supabase', sub:'Không ai xem data của bạn' },
            { icon:<Calendar size={16}/>, text:'Trial 14 ngày', sub:'Không cần thẻ tín dụng' },
            { icon:<Download size={16}/>, text:'Xuất data tự do', sub:'Không bị lock-in' },
          ].map(k => (
            <div key={k.text} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 text-emerald-600">{k.icon}</div>
              <div>
                <p className="text-xs font-bold text-slate-800">{k.text}</p>
                <p className="text-[10px] text-slate-400">{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Câu hỏi thường gặp</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {FAQ.map((faq, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors">
                  <p className="text-sm font-semibold text-slate-800 pr-4">{faq.q}</p>
                  {openFaq === i ? <ChevronUp size={14} className="text-slate-400 shrink-0"/> : <ChevronDown size={14} className="text-slate-400 shrink-0"/>}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trial/Payment Modal */}
      <ModalForm
        open={showPayForm}
        onClose={() => setShowPayForm(false)}
        title={`Kích hoạt trial 14 ngày — ${selectedPlan === 'starter' ? 'Starter' : 'Pro'}`}
        subtitle="Không cần thẻ tín dụng. Hủy bất cứ lúc nào."
        icon={<Star size={18}/>}
        color="emerald"
        width="md"
        footer={<>
          <BtnCancel onClick={() => setShowPayForm(false)}/>
          <BtnSubmit label="🚀 Bắt đầu trial miễn phí" onClick={handleStartTrial}/>
        </>}
      >
        <FormGrid cols={2}>
          <FormRow label="Tên công ty *" className="col-span-2">
            <input className={inputCls} placeholder="VD: Công ty TNHH XD Phúc Thành"
              value={payForm.company} onChange={e => setPayForm(p => ({...p, company: e.target.value}))}/>
          </FormRow>
          <FormRow label="Email nhận thông báo *">
            <input type="email" className={inputCls} placeholder="email@congty.vn"
              value={payForm.email} onChange={e => setPayForm(p => ({...p, email: e.target.value}))}/>
          </FormRow>
          <FormRow label="Số điện thoại">
            <input className={inputCls} placeholder="0901 234 567"
              value={payForm.phone} onChange={e => setPayForm(p => ({...p, phone: e.target.value}))}/>
          </FormRow>
        </FormGrid>
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 leading-relaxed">
          ✅ <strong>14 ngày dùng thử đầy đủ tính năng</strong> — không giới hạn, không cần thanh toán.
          Sau 14 ngày em sẽ nhắc anh chọn gói hoặc hủy — không tự động trừ tiền.
        </div>
      </ModalForm>
    </div>
  );
}
