/**
 * BillingPage.tsx — GEM & CLAUDE PM Pro
 * S17 — 3 gói dịch vụ: Starter / Pro / Enterprise
 * VNPay mock integration + trial 30 ngày + invoice tự động
 */
import React, { useState, useEffect } from 'react';
import { useNotification } from './NotificationEngine';
import { getSupabase, type PlanId } from './supabase';
import { useAuth } from './AuthProvider';
import ModalForm, { FormRow, FormGrid, inputCls, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import {
  Check, X, Zap, Shield, Crown, CreditCard,
  Calendar, Download, AlertTriangle, ChevronDown, ChevronUp,
  Building2, Users, HardDrive, Lock, Star, Clock, CheckCircle,
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

// M4 Hybrid: theo dự án + free worker L1-L2
// Starter: 1 DA · 5 seats L3+ · Worker unlimited
// Pro: 5 DA · 15 seats L3+ · Worker unlimited
// Enterprise: Custom · Unlimited
const PLANS: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: { monthly: 990_000, yearly: 9_900_000 },
    users: '5 seats quản lý (L3+)',
    projects: '1 dự án',
    storage: '5 GB',
    color: 'slate',
    icon: <Zap size={20}/>,
    features: [
      'Worker L1-L2 không giới hạn (miễn phí)',
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
    ],
    cta: 'Dùng thử 30 ngày',
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Phổ biến nhất',
    price: { monthly: 2_490_000, yearly: 24_900_000 },
    users: '15 seats quản lý (L3+)',
    projects: '5 dự án',
    storage: '50 GB',
    color: 'emerald',
    icon: <Shield size={20}/>,
    features: [
      'Worker L1-L2 không giới hạn (miễn phí)',
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
    cta: 'Dùng thử 30 ngày',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: { monthly: 0, yearly: 0 },
    users: 'Không giới hạn',
    projects: 'Không giới hạn',
    storage: 'Không giới hạn',
    color: 'violet',
    icon: <Crown size={20}/>,
    features: [
      'Tất cả tính năng Pro',
      'Server riêng hoàn toàn (Single-tenant)',
      'Data isolated 100% — GEM&CLAUDE host hộ',
      'Tự quản lý user — không cần IT',
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
  { q: 'Trial 30 ngày có cần thẻ tín dụng không?', a: 'Không. Đăng ký email là dùng thử ngay, không cần thông tin thanh toán. Sau 30 ngày sẽ nhận email nhắc chọn gói.' },
];

export default function BillingPage({ onClose }: { onClose?: () => void }) {
  const { ok: notifOk, err: notifErr, info: notifInfo } = useNotification();
  const { user } = useAuth();
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const [showPayForm, setShowPayForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [payForm, setPayForm] = useState({
    company: '',
    email:   user?.email ?? '',
    phone:   user?.phone ?? '',
    method:  'payos',
  });
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plans'|'history'>('plans');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Load payment history
  useEffect(() => {
    if (activeTab !== 'history' || !user?.tenant_id) return;
    setLoadingTx(true);
    (async () => {
      const sb = getSupabase();
      if (!sb) { setLoadingTx(false); return; }
      const { data } = await sb
        .from('payment_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setTransactions(data || []);
      setLoadingTx(false);
    })();
  }, [activeTab, user?.tenant_id]);

  // Tính ngày trial còn lại từ user thật
  const trialDaysLeft = (() => {
    if (!user?.trial_ends_at) return 0;
    const diff = new Date(user.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();
  const currentPlan = user?.plan_id ?? 'trial';

  const yearlyDiscount = 17;
  const fmt = (n: number) => n === 0 ? 'Liên hệ' : `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M đ`;

  const handleSelectPlan = (plan: Plan) => {
    if (plan === 'enterprise') {
      notifInfo('Vui lòng liên hệ: gemclaudepm@gmail.com hoặc hotline để được tư vấn gói Enterprise.');
      return;
    }
    if ((currentPlan as string) === (plan as string) && currentPlan !== 'trial') {
      notifInfo(`Anh đang dùng gói ${plan.toUpperCase()} rồi.`);
      return;
    }
    setSelectedPlan(plan);
    setShowPayForm(true);
  };

  // S26: Stripe + PayOS checkout
  const STRIPE_PRICES: Record<string, Record<string, string>> = {
    starter:  { monthly: 'price_starter_monthly',  yearly: 'price_starter_yearly'  },
    pro:      { monthly: 'price_pro_monthly',       yearly: 'price_pro_yearly'      },
    enterprise: { monthly: 'price_enterprise_monthly', yearly: 'price_enterprise_monthly' },
  };

  const handleUpgrade = async () => {
    if (!payForm.email?.includes('@')) { notifErr('Vui lòng nhập email hợp lệ!'); return; }
    if (!selectedPlan) return;
    setUpgrading(true);
    try {
      const sb = getSupabase();
      if (!sb || !user?.tenant_id) throw new Error('Cần đăng nhập để nâng cấp.');

      if (payForm.method === 'stripe') {
        // Stripe Checkout — gọi Edge Function tạo session
        const priceId = STRIPE_PRICES[selectedPlan]?.[cycle];
        const { data, error } = await sb.functions.invoke('create-checkout-session', {
          body: {
            price_id:    priceId,
            tenant_id:   user.tenant_id,
            customer_email: payForm.email,
            success_url: `${window.location.origin}?upgraded=1`,
            cancel_url:  window.location.href,
          },
        });
        if (error) throw new Error(error.message);
        // Redirect to Stripe Checkout
        if (data?.url) { window.location.href = data.url; return; }
      } else {
        // PayOS — tạo payment link
        const PLAN_PRICES: Record<string, Record<string, number>> = {
          starter:  { monthly: 990000,  yearly: 9900000  },
          pro:      { monthly: 2490000, yearly: 24900000 },
          enterprise: { monthly: 0, yearly: 0 },
        };
        const amount = PLAN_PRICES[selectedPlan]?.[cycle] ?? 0;
        const orderCode = `GEMPM_${user.tenant_id}_${Date.now()}`;
        const { data, error } = await sb.functions.invoke('create-payos-link', {
          body: { amount, orderCode, description: `GEM PM ${selectedPlan} ${cycle}`, buyerEmail: payForm.email },
        });
        if (error) throw new Error(error.message);
        if (data?.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      }

      // Fallback nếu không có Edge Function — hiển thị thông báo chuyển khoản
      notifOk('Vui lòng chuyển khoản theo thông tin email — tài khoản sẽ được kích hoạt trong 1 giờ.');
      setShowPayForm(false);
    } catch (e: any) {
      notifErr(`Lỗi thanh toán: ${e.message}`);
    } finally {
      setUpgrading(false);
    }
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
        <p className="text-slate-500 text-sm max-w-lg mx-auto">Tất cả gói đều có trial 30 ngày miễn phí. Không cần thẻ tín dụng.</p>

        {/* Trial / current plan status */}
        {currentPlan === 'trial' && (
          <div className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full text-xs font-bold ${
            trialDaysLeft <= 3 ? 'bg-red-100 text-red-700' :
            trialDaysLeft <= 7 ? 'bg-amber-100 text-amber-700' :
                                 'bg-emerald-100 text-emerald-700'
          }`}>
            <Clock size={12}/>
            {trialDaysLeft > 0
              ? `Còn ${trialDaysLeft} ngày dùng thử — hãy chọn gói để không gián đoạn`
              : 'Trial đã hết hạn — vui lòng nâng cấp để tiếp tục'}
          </div>
        )}
        {currentPlan !== 'trial' && (
          <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
            <CheckCircle size={12}/>
            Anh đang dùng gói {currentPlan.toUpperCase()}
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <span className={`text-sm font-semibold ${cycle === 'monthly' ? 'text-slate-800' : 'text-slate-400'}`}>Hàng tháng</span>
          <button
            onClick={() => setCycle(c => c === 'monthly' ? 'yearly' : 'monthly')}
            style={{ width: 48, height: 28, position: 'relative', borderRadius: 14, border: 'none', cursor: 'pointer', transition: 'background 0.2s', background: cycle === 'yearly' ? '#10b981' : '#cbd5e1', flexShrink: 0 }}
          >
            <span style={{
              position: 'absolute', top: 3, width: 22, height: 22,
              background: 'white', borderRadius: '50%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.2s',
              left: cycle === 'yearly' ? 23 : 3,
            }}/>
          </button>
          <span className={`text-sm font-semibold ${cycle === 'yearly' ? 'text-slate-800' : 'text-slate-400'}`}>
            Hàng năm
            <span className="ml-1.5 text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              -{yearlyDiscount}%
            </span>
          </span>
        </div>
      </div>

      {/* ── Tab switcher ──────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 pt-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          <button onClick={() => setActiveTab('plans')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab==='plans'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>
            💎 Gói dịch vụ
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab==='history'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>
            📋 Lịch sử thanh toán
          </button>
        </div>
      </div>

      {/* ── Payment History Tab ────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CreditCard size={16} className="text-emerald-600"/> Lịch sử giao dịch
              </h3>
              <span className="text-xs text-slate-400">{transactions.length} giao dịch</span>
            </div>
            {loadingTx ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                <Loader2 size={18} className="animate-spin"/> Đang tải...
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-3xl mb-3">📭</div>
                <p className="text-sm text-slate-400 mb-4">Chưa có giao dịch nào</p>
                <div className="text-left max-w-md mx-auto bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="font-bold text-blue-800 text-sm mb-2">ℹ️ Kích hoạt PayOS live:</p>
                  <ol className="space-y-1.5 text-xs text-blue-700">
                    <li>1. Đăng ký doanh nghiệp tại <strong>payos.vn</strong></li>
                    <li>2. Lấy Client ID, API Key, Checksum Key</li>
                    <li>3. Thêm vào Supabase Secrets: <code className="bg-blue-100 px-1 rounded">PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY</code></li>
                    <li>4. Deploy: <code className="bg-blue-100 px-1 rounded">supabase functions deploy create-payos-link</code></li>
                    <li>5. Webhook URL trong PayOS Dashboard: <code className="bg-blue-100 px-1 rounded">/functions/v1/payos-webhook</code></li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-6 gap-3 px-5 py-2.5 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  <span className="col-span-2">Mô tả</span><span>Số tiền</span><span>Cổng TT</span><span>Trạng thái</span><span>Ngày</span>
                </div>
                {transactions.map(tx => (
                  <div key={tx.id} className="grid grid-cols-6 gap-3 px-5 py-3.5 items-center text-sm hover:bg-slate-50">
                    <div className="col-span-2">
                      <p className="font-semibold text-slate-800 truncate">{tx.description||'GEM PM Pro'}</p>
                      <p className="text-[10px] text-slate-400">#{tx.order_code}</p>
                    </div>
                    <span className="font-bold text-emerald-700">{tx.amount?.toLocaleString('vi-VN')}đ</span>
                    <span className="text-xs">{tx.gateway==='payos'?'🏦 PayOS':'💳 Stripe'}</span>
                    <span>
                      {tx.status==='paid'
                        ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✅ Thành công</span>
                        : tx.status==='pending'
                        ? <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⏳ Chờ TT</span>
                        : <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">❌ Thất bại</span>}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(tx.paid_at||tx.created_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Plans Tab ──────────────────────────────────────── */}
      {activeTab === 'plans' && <>
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
            { icon:<Calendar size={16}/>, text:'Trial 30 ngày', sub:'Không cần thẻ tín dụng' },
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

      </> /* end plans tab */}

      </> /* end plans tab */}

      {/* Trial/Payment Modal */}
      <ModalForm
        open={showPayForm}
        onClose={() => setShowPayForm(false)}
        title={`Kích hoạt trial 30 ngày — ${selectedPlan === 'starter' ? 'Starter' : 'Pro'}`}
        subtitle="Không cần thẻ tín dụng. Hủy bất cứ lúc nào."
        icon={<Star size={18}/>}
        color="emerald"
        width="md"
        footer={<>
          <BtnCancel onClick={() => setShowPayForm(false)}/>
          <BtnSubmit label={upgrading ? "Đang xử lý..." : "🚀 Xác nhận nâng cấp"} onClick={handleUpgrade}/>
        </>}
      >
        <FormGrid cols={2}>
          <div className="col-span-2"><FormRow label="Tên công ty *">
            <input className={inputCls} placeholder="VD: Công ty TNHH XD Phúc Thành"
              value={payForm.company} onChange={e => setPayForm(p => ({...p, company: e.target.value}))}/>
          </FormRow></div>
          <FormRow label="Email nhận thông báo *">
            <input type="email" className={inputCls} placeholder="email@congty.vn"
              value={payForm.email} onChange={e => setPayForm(p => ({...p, email: e.target.value}))}/>
          </FormRow>
          <FormRow label="Số điện thoại">
            <input className={inputCls} placeholder="0901 234 567"
              value={payForm.phone} onChange={e => setPayForm(p => ({...p, phone: e.target.value}))}/>
          </FormRow>
        </FormGrid>
        <FormRow label="Phương thức thanh toán">
          <div className="flex gap-2">
            {([["payos","PayOS (VNPay/ATM/QR)"],["stripe","Thẻ quốc tế (Stripe)"]] as const).map(([m,lbl]) => (
              <label key={m} className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input type="radio" name="method" value={m}
                  checked={payForm.method===m}
                  onChange={() => setPayForm(p=>({...p,method:m}))}
                  className="accent-emerald-600"/>
                {lbl}
              </label>
            ))}
          </div>
        </FormRow>
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 leading-relaxed">
          ✅ <strong>30 ngày dùng thử đầy đủ tính năng</strong> — không giới hạn, không cần thanh toán.
          Sau 30 ngày em sẽ nhắc anh chọn gói hoặc hủy — không tự động trừ tiền.
        </div>
      </ModalForm>
    </div>
  );
}
