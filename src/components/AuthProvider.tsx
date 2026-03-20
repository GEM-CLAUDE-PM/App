/**
 * AuthProvider.tsx — GEM&CLAUDE PM Pro
 * React context wrapping Supabase Auth (real users only).
 * Provides: useAuth() hook, <AuthGuard>, login screen, UserMenu.
 * Role is read from profiles.job_role (set by admin via Supabase Dashboard).
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import {
  AuthService, Permissions,
  JOB_LABELS, TIER_LABELS, TIER_COLORS, JOB_ROLE_TO_ROLE_ID,
  type UserProfile, type TierRole, type JobRole,
} from './supabase';
import { getRoleProjectScope } from './permissions';
import {
  LogIn, LogOut, User, Shield, ChevronDown, Loader2,
  Eye, EyeOff, AlertCircle, CheckCircle2, CheckCircle, Lock, Building2,
  Sparkles, RefreshCw, UserCircle, Settings, X, Mail, UserPlus,
  Phone, Calendar, Badge, Users, CreditCard,
} from 'lucide-react';

// ─── Context ──────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: UserProfile | null;
  perm: Permissions;
  loading: boolean;
  /** RoleId từ permissions.ts — derived từ user.job_role qua JOB_ROLE_TO_ROLE_ID */
  roleId: string;
  /** allowedProjectIds: null = L4+ (xem tất cả), string[] = L1-L3 (chỉ những project được gán) */
  allowedProjectIds: string[] | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;

}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  perm: new Permissions(null),
  loading: true,
  roleId: 'chi_huy_truong',
  allowedProjectIds: null,
  signIn: async () => null,
  signOut: async () => {},

});

export const useAuth = () => useContext(AuthContext);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Restore session on mount
  // .catch() bắt buộc — iOS Chrome (WebKit/ITP) có thể reject promise
  // nếu không catch: setLoading(false) không chạy → màn trắng mãi
  useEffect(() => {
    AuthService.restoreSession()
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { user: u, error } = await AuthService.signIn(email, password);
    if (error || !u) return error ?? 'Đăng nhập thất bại.';
    AuthService.persistSession(u);
    setUser(u);
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await AuthService.signOut();
    setUser(null);
  }, []);

  const perm = new Permissions(user);

  // G5 fix: derive roleId và allowedProjectIds từ Supabase user profile
  // jobRole (supabase.ts JobRole) → roleId (permissions.ts RoleId) qua JOB_ROLE_TO_ROLE_ID
  const roleId: string = user
    ? (JOB_ROLE_TO_ROLE_ID[user.job_role] || user.job_role)
    : 'chi_huy_truong';

  // allowedProjectIds:
  //   L4+ (admin tier)  → null  = thấy tất cả
  //   L3  (manager tier)→ user.project_ids (admin đã gán qua Supabase Dashboard)
  //   L1-L2 (worker tier)→ user.project_ids (cứng 1 project)
  const allowedProjectIds: string[] | null = (() => {
    if (!user) return [];
    const scope = getRoleProjectScope(roleId as any);
    if (scope === 'all') return null;         // L4+ — không giới hạn
    return user.project_ids ?? [];            // L1-L3 — chỉ project được admin gán
  })();

  // Sync roleId và allowedProjectIds vào localStorage — trong useEffect tránh iOS re-render loop
  React.useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem('gem_user_role', roleId);
      if (allowedProjectIds !== null) {
        localStorage.setItem(`gem_member_projects_user_${user.id}`, JSON.stringify(allowedProjectIds));
        localStorage.setItem(`gem_member_projects_user_${roleId}`, JSON.stringify(allowedProjectIds));
      }
    } catch {}
  }, [user?.id, roleId]);

  return (
    <AuthContext.Provider value={{ user, perm, loading, roleId, allowedProjectIds, signIn, signOut }}>
      {loading ? <SplashScreen /> : !user ? <LoginScreen onSignIn={signIn} /> : children}
    </AuthContext.Provider>
  );
}

// ─── Splash Screen ────────────────────────────────────────────────────────────
function SplashScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
          <Sparkles size={32} className="text-violet-300" />
        </div>
        <p className="text-violet-200 font-semibold text-lg tracking-wide">Nàng GEM Siêu Việt</p>
        <div className="flex items-center gap-2 text-violet-400 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Đang khởi động hệ thống...
        </div>
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onSignIn }: { onSignIn: (e: string, p: string) => Promise<string | null> }) {
  const [mode, setMode]         = useState<'login' | 'signup' | 'phone'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);
  // Signup fields
  const [fullName, setFullName]       = useState('');
  const [companyName, setCompanyName] = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  // M4: Phone OTP fields
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState('');
  const [otpSent, setOtpSent]     = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const handleSignup = async () => {
    if (!fullName.trim())    { setError('Vui lòng nhập họ tên.'); return; }
    if (!companyName.trim()) { setError('Vui lòng nhập tên công ty.'); return; }
    if (!email.trim())       { setError('Vui lòng nhập email.'); return; }
    if (password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự.'); return; }
    if (password !== confirmPw) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setLoading(true); setError('');
    const { error: err } = await AuthService.signUp({ email, password, full_name: fullName, company_name: companyName });
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess('Tài khoản đã tạo thành công! Kiểm tra email để xác nhận trước khi đăng nhập.');
  };

  const handleSendOTP = async () => {
    const p = phone.trim();
    if (!/^(0|\+84)[0-9]{9}$/.test(p)) { setError('Số điện thoại không hợp lệ (VD: 0901234567).'); return; }
    setOtpLoading(true); setError('');
    const { error: err } = await AuthService.sendPhoneOTP(p);
    setOtpLoading(false);
    if (err) { setError(err); return; }
    setOtpSent(true);
    setSuccess('OTP đã gửi — kiểm tra tin nhắn SMS trên điện thoại.');
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { setError('OTP gồm 6 chữ số.'); return; }
    setLoading(true); setError('');
    const { user: u, error: err } = await AuthService.verifyPhoneOTP(phone.trim(), otp.trim());
    setLoading(false);
    if (err || !u) { setError(err ?? 'Xác minh thất bại.'); return; }
    // onSignIn không cần gọi — verifyPhoneOTP đã persistSession
    window.location.reload();
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email) { setError('Vui lòng nhập email.'); return; }
    if (!password) { setError('Vui lòng nhập mật khẩu.'); return; }
    setLoading(true); setError('');
    const err = await onSignIn(email, password);
    if (err) { setError(err); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-violet-900/50">
            <Building2 size={36} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">GEM&CLAUDE PM Pro</h1>
            <p className="text-violet-300 text-sm mt-1 flex items-center justify-center gap-1.5">
              <Sparkles size={13} /> Nàng GEM Siêu Việt
            </p>
          </div>

        </div>

        {/* Login / Signup form */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
          {/* Mode toggle */}
          <div className="flex bg-white/10 rounded-2xl p-1 gap-1">
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode==='login' ? 'bg-violet-600 text-white shadow' : 'text-violet-300 hover:text-white'}`}>
              Đăng nhập
            </button>
            <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode==='signup' ? 'bg-violet-600 text-white shadow' : 'text-violet-300 hover:text-white'}`}>
              Đăng ký dùng thử
            </button>
            <button onClick={() => { setMode('phone'); setError(''); setSuccess(''); setOtpSent(false); setOtp(''); }}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode==='phone' ? 'bg-violet-600 text-white shadow' : 'text-violet-300 hover:text-white'}`}>
              <span className="flex items-center justify-center gap-1"><Phone size={12}/>SĐT</span>
            </button>
          </div>

          {/* Success message */}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
              <CheckCircle size={16} className="shrink-0 mt-0.5" /> {success}
            </div>
          )}

          {mode === 'signup' && !success && (
            <>
              {/* Full name */}
              <div>
                <label className="text-violet-200 text-xs font-semibold mb-1.5 block">Họ và tên *</label>
                <div className="relative">
                  <UserCircle size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={fullName} onChange={e => { setFullName(e.target.value); setError(''); }}
                    placeholder="Nguyễn Văn A"
                    className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              {/* Company name */}
              <div>
                <label className="text-violet-200 text-xs font-semibold mb-1.5 block">Tên công ty *</label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={companyName} onChange={e => { setCompanyName(e.target.value); setError(''); }}
                    placeholder="Công ty TNHH Xây dựng ABC"
                    className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
            </>
          )}

          {!success && (
            <>
              {/* Email */}
              <div>
                <label className="text-violet-200 text-xs font-semibold mb-1.5 block">Email *</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleLogin()}
                    placeholder="email@company.vn"
                    className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-violet-200 text-xs font-semibold mb-1.5 block">Mật khẩu *</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleLogin()}
                    placeholder={mode === 'signup' ? 'Tối thiểu 6 ký tự' : '••••••••'}
                    className="w-full pl-9 pr-10 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  <button onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm password (signup only) */}
              {mode === 'signup' && (
                <div>
                  <label className="text-violet-200 text-xs font-semibold mb-1.5 block">Xác nhận mật khẩu *</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type={showPw ? 'text' : 'password'} value={confirmPw}
                      onChange={e => { setConfirmPw(e.target.value); setError(''); }}
                      placeholder="Nhập lại mật khẩu"
                      className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
                  <AlertCircle size={15} className="shrink-0" /> {error}
                </div>
              )}

              {/* Trial note (signup) */}
              {mode === 'signup' && (
                <div className="flex items-center gap-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-violet-300 text-xs">
                  <Sparkles size={13} className="shrink-0" />
                  Dùng thử miễn phí 30 ngày — đầy đủ tính năng, không cần thẻ tín dụng
                </div>
              )}

              {/* Submit */}
              <button
                onClick={() => mode === 'login' ? handleLogin() : handleSignup()}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/40 transition-all"
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" />{mode === 'login' ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...'}</>
                  : mode === 'login'
                    ? <><LogIn size={15} />Đăng nhập</>
                    : <><UserPlus size={15} />Tạo tài khoản & bắt đầu dùng thử</>
                }
              </button>
            </>
          )}

          {/* M4: Phone OTP form */}
          {mode === 'phone' && (
            <div className="space-y-3">
              <p className="text-violet-200 text-xs text-center">Đăng nhập bằng số điện thoại — nhận OTP qua SMS</p>
              <div>
                <label className="text-violet-200 text-xs font-semibold mb-1.5 block">Số điện thoại</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400"/>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="0901 234 567"
                    className="w-full bg-white/10 border border-white/20 rounded-2xl pl-10 pr-4 py-3 text-white placeholder-violet-400 text-sm focus:outline-none focus:border-violet-400"
                    disabled={otpSent}/>
                </div>
              </div>
              {!otpSent ? (
                <button onClick={handleSendOTP} disabled={otpLoading}
                  className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {otpLoading ? <Loader2 size={15} className="animate-spin"/> : <Phone size={15}/>}
                  {otpLoading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-violet-200 text-xs font-semibold mb-1.5 block">Mã OTP (6 chữ số)</label>
                    <input type="text" inputMode="numeric" maxLength={6}
                      value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,''))}
                      placeholder="_ _ _ _ _ _"
                      className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white text-center text-xl tracking-widest placeholder-violet-400 focus:outline-none focus:border-violet-400"
                    />
                  </div>
                  <button onClick={handleVerifyOTP} disabled={loading}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle2 size={15}/>}
                    {loading ? 'Đang xác minh...' : 'Xác nhận OTP'}
                  </button>
                  <button onClick={() => { setOtpSent(false); setOtp(''); setSuccess(''); }}
                    className="w-full text-xs text-violet-400 hover:text-violet-200 py-1">Đổi số điện thoại</button>
                </div>
              )}
            </div>
          )}

        </div>

        <p className="text-center text-slate-500 text-xs">
          GEM&CLAUDE PM Pro · Powered by Nàng GEM Siêu Việt
        </p>
      </div>
    </div>
  );
}

// ─── AuthGuard — wraps pages requiring minimum tier ──────────────────────────
export function AuthGuard({ minTier = 'worker', children }: { minTier?: TierRole; children: React.ReactNode }) {
  const { perm } = useAuth();
  if (perm.atLeast(minTier)) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mb-4">
        <Lock size={28} className="text-rose-500" />
      </div>
      <p className="text-slate-700 font-bold text-lg mb-2">Không có quyền truy cập</p>
      <p className="text-slate-400 text-sm">Bạn cần quyền <strong>{TIER_LABELS[minTier]}</strong> để xem nội dung này.</p>
    </div>
  );
}

// ─── UserMenu — top-right dropdown in Taskbar ─────────────────────────────────
export function UserMenu({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const { user, perm, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;
  const tc = TIER_COLORS[user.tier];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tc.bg}`}>
          <UserCircle size={18} className={tc.text} />
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-bold text-slate-700 leading-none">{user.full_name}</p>
          <p className={`text-[10px] font-semibold mt-0.5 ${tc.text}`}>{JOB_LABELS[user.job_role]}</p>
        </div>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
          {/* Profile header */}
          <div className={`p-4 ${tc.bg} bg-opacity-50`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tc.bg}`}>
                <UserCircle size={24} className={tc.text} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{user.full_name}</p>
                <p className={`text-xs font-semibold ${tc.text}`}>{JOB_LABELS[user.job_role]}</p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full mt-1 ${tc.bg} ${tc.text} ${tc.border} border`}>
                  <Shield size={9} /> {TIER_LABELS[user.tier]}
                </span>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Mail size={12} className="text-slate-400 shrink-0" />{user.email}
            </div>
            {user.phone && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Phone size={12} className="text-slate-400 shrink-0" />{user.phone}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Building2 size={12} className="text-slate-400 shrink-0" />
              {user.project_ids.length} dự án liên kết
            </div>
            {typeof localStorage !== 'undefined' && localStorage.getItem('gem_company_name') && (
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
                <Building2 size={12} className="text-teal-500 shrink-0" />
                {localStorage.getItem('gem_company_name')}
              </div>
            )}
          </div>

          {/* Permissions summary */}
          <div className="p-3 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Quyền truy cập</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Hợp đồng', ok: perm.canViewContracts },
                { label: 'Tài chính', ok: perm.canViewFullFinancials },
                { label: 'QS / VO', ok: perm.canViewQS },
                { label: 'Kế toán', ok: perm.canViewAccounting },
                { label: 'HR', ok: perm.canViewHR },
                { label: 'Quản lý user', ok: perm.canManageUsers },
              ].map(p => (
                <div key={p.label} className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg font-semibold ${p.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
                  {p.ok ? <CheckCircle2 size={10} /> : <X size={10} />}
                  {p.label}
                </div>
              ))}
            </div>
          </div>


          {/* Billing — chỉ admin */}
          {user.tier === 'admin' && onNavigate && (
            <div className="px-3 pb-2">
              <button
                onClick={() => { setOpen(false); onNavigate('billing'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              >
                <CreditCard size={15} className="text-emerald-500 shrink-0"/>
                Gói dịch vụ & Thanh toán
              </button>
            </div>
          )}

          {/* Sign out */}
          <div className="p-3">
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-sm font-semibold transition-colors"
            >
              <LogOut size={15} /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
