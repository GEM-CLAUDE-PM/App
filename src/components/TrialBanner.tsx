/**
 * TrialBanner.tsx — GEM & CLAUDE PM Pro
 * S17 — Banner đếm ngược trial, hiển thị phía trên app khi plan_id = 'trial'
 * Tự động tính ngày còn lại từ trial_ends_at trên UserProfile.
 * Ẩn hoàn toàn khi đã upgrade hoặc khi user dismiss (sessionStorage).
 */
import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Zap } from 'lucide-react';
import type { UserProfile } from './supabase';

interface TrialBannerProps {
  user: UserProfile;
  onUpgrade: () => void;  // navigate sang BillingPage
}

function calcDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function TrialBanner({ user, onUpgrade }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Không hiển thị nếu đã upgrade hoặc không có trial_ends_at
  if (user.plan_id !== 'trial' || !user.trial_ends_at) return null;

  // Kiểm tra dismiss trong session (reset mỗi lần mở tab mới)
  useEffect(() => {
    setDismissed(sessionStorage.getItem('gem_trial_banner_dismissed') === '1');
  }, []);

  if (dismissed) return null;

  const daysLeft = calcDaysLeft(user.trial_ends_at);
  const isExpired = daysLeft === 0;
  const isUrgent  = daysLeft <= 3;

  function handleDismiss() {
    sessionStorage.setItem('gem_trial_banner_dismissed', '1');
    setDismissed(true);
  }

  // Màu theo urgency
  const colorCls = isExpired
    ? 'bg-red-600 text-white'
    : isUrgent
    ? 'bg-amber-500 text-white'
    : 'bg-emerald-600 text-white';

  const companyName = typeof localStorage !== 'undefined' ? localStorage.getItem('gem_company_name') : null;
  const message = isExpired
    ? `${companyName ? companyName + ' — ' : ''}Tài khoản dùng thử đã hết hạn. Vui lòng nâng cấp để tiếp tục.`
    : `${companyName ? '🏢 ' + companyName + ' · ' : ''}Còn ${daysLeft} ngày dùng thử — nâng cấp để không bị gián đoạn.`;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-xs font-medium ${colorCls} relative z-50`}>
      <AlertTriangle size={14} className="shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onUpgrade}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1 font-bold transition-colors"
      >
        <Zap size={12} />
        Nâng cấp ngay
      </button>
      {!isExpired && (
        <button
          onClick={handleDismiss}
          className="hover:bg-white/20 rounded p-0.5 transition-colors"
          title="Ẩn thông báo"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
