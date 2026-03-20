/**
 * PWABanner.tsx — GEM&CLAUDE PM Pro
 * UI components for PWA states:
 *   <InstallBanner>    — "Add to Home Screen" prompt
 *   <UpdateBanner>     — New version available
 *   <OfflineIndicator> — Offline status pill
 *   <PWAManager>       — Combines all three (drop into App.tsx)
 */

import React, { useState } from 'react';
import {
  Download, RefreshCw, WifiOff, Wifi, X,
  Smartphone, Sparkles, CheckCircle2, ArrowDown,
} from 'lucide-react';
import { usePWA, usePWADeepLink } from './usePWA';

// ─── iOS Debug Logger — TẠM THỜI, XÓA SAU KHI FIX ──────────────────────────
function IOSDebugLog() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  React.useEffect(() => {
    if (!isIOS) return;
    const t = setTimeout(() => {
      const logs: string[] = [];
      document.querySelectorAll('*').forEach(el => {
        const s = window.getComputedStyle(el);
        if (s.position === 'fixed' && parseInt(s.zIndex) > 100) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100) {
            logs.push(`z${s.zIndex}: ${el.className.slice(0, 50)} [${Math.round(rect.width)}x${Math.round(rect.height)}]`);
          }
        }
      });
      if (logs.length > 0) {
        alert('iOS DEBUG fixed elements:\n' + logs.join('\n'));
      } else {
        alert('iOS DEBUG: không có fixed element lớn nào sau 800ms');
      }
    }, 800);
    return () => clearTimeout(t);
  }, []);
  return null;
}

// ─── Offline pill ─────────────────────────────────────────────────────────────
export function OfflineIndicator({ isOnline }: { isOnline: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (isOnline || dismissed) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] print:hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/90 backdrop-blur-md
        border border-amber-700/50 rounded-2xl shadow-2xl text-amber-100 text-sm font-semibold">
        <WifiOff size={15} className="text-amber-300 shrink-0"/>
        <span>Đang offline — dữ liệu sẽ đồng bộ khi có mạng</span>
        <button onClick={() => setDismissed(true)} className="ml-1 hover:text-white">
          <X size={13}/>
        </button>
      </div>
    </div>
  );
}

// ─── Back online toast ────────────────────────────────────────────────────────
export function OnlineToast({ isOnline }: { isOnline: boolean }) {
  const [show, setShow] = useState(false);
  const prev = React.useRef(isOnline);

  React.useEffect(() => {
    if (!prev.current && isOnline) {
      setShow(true);
      setTimeout(() => setShow(false), 3000);
    }
    prev.current = isOnline;
  }, [isOnline]);

  if (!show) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-bounce print:hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/90 backdrop-blur-md
        border border-emerald-700/50 rounded-2xl shadow-2xl text-emerald-100 text-sm font-semibold">
        <Wifi size={15} className="text-emerald-300"/>
        Đã kết nối lại — đang đồng bộ dữ liệu...
        <CheckCircle2 size={15} className="text-emerald-300"/>
      </div>
    </div>
  );
}

// ─── Install banner ───────────────────────────────────────────────────────────
export function InstallBanner({
  isInstallable, isInstalled, onInstall,
}: {
  isInstallable: boolean;
  isInstalled: boolean;
  onInstall: () => Promise<void>;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || isInstalled || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[9998] print:hidden">
      <div className="bg-gradient-to-br from-violet-900 to-purple-900 border border-violet-700/50
        rounded-2xl shadow-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-violet-700/50 rounded-2xl flex items-center justify-center shrink-0">
            <Smartphone size={22} className="text-violet-200"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Cài GEM PM Pro về điện thoại</p>
            <p className="text-violet-300 text-xs mt-0.5 leading-relaxed">
              Truy cập nhanh hơn, hoạt động offline, nhận thông báo trực tiếp.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={onInstall}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-500 hover:bg-violet-400
                  rounded-xl text-xs font-bold transition-colors"
              >
                <ArrowDown size={13}/> Cài ngay
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold transition-colors"
              >
                Để sau
              </button>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="p-1 hover:bg-white/10 rounded-lg shrink-0">
            <X size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Update banner ────────────────────────────────────────────────────────────
export function UpdateBanner({
  updateAvailable, onApply, onDismiss,
}: {
  updateAvailable: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] print:hidden">
      <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-4 py-3
        flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-emerald-200 shrink-0"/>
          Phiên bản mới của GEM PM Pro đã sẵn sàng!
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onApply}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-700
              rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors"
          >
            <RefreshCw size={12}/> Cập nhật ngay
          </button>
          <button onClick={onDismiss} className="p-1.5 hover:bg-white/20 rounded-lg">
            <X size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PWAManager — drop into App.tsx once ─────────────────────────────────────
export function PWAManager({
  onNavigate,
}: {
  onNavigate?: (tab: string, sub?: string, extra?: Record<string, string>) => void;
}) {
  const { isOnline, isInstallable, isInstalled, updateAvailable, installPrompt, applyUpdate, dismissUpdate } = usePWA();

  // Handle deep links from manifest shortcuts
  usePWADeepLink((tab, sub, extra) => {
    onNavigate?.(tab, sub, extra);
  });

  return (
    <>
      <IOSDebugLog />
      <OfflineIndicator isOnline={isOnline} />
      <OnlineToast isOnline={isOnline} />
      <InstallBanner isInstallable={isInstallable} isInstalled={isInstalled} onInstall={installPrompt} />
      <UpdateBanner updateAvailable={updateAvailable} onApply={applyUpdate} onDismiss={dismissUpdate} />
    </>
  );
}
