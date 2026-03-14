/**
 * usePWA.ts — GEM&CLAUDE PM Pro
 * Hook quản lý toàn bộ PWA lifecycle:
 *   - Đăng ký Service Worker
 *   - Bắt sự kiện "Add to Home Screen" (beforeinstallprompt)
 *   - Theo dõi online/offline status
 *   - Hiển thị update available banner
 *   - Deep link từ shortcuts (URL params)
 *
 * SETUP:
 *   1. Copy sw.js → /public/sw.js
 *   2. Copy manifest.json → /public/manifest.json
 *   3. Copy offline.html → /public/offline.html
 *   4. Add to index.html <head>:
 *        <link rel="manifest" href="/manifest.json" />
 *        <meta name="theme-color" content="#059669" />
 *        <meta name="apple-mobile-web-app-capable" content="yes" />
 *        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
 *        <meta name="apple-mobile-web-app-title" content="GEM PM" />
 *        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
 *   5. Call usePWA() in App.tsx root
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PWAState {
  isOnline: boolean;
  isInstalled: boolean;
  isInstallable: boolean;
  updateAvailable: boolean;
  swRegistered: boolean;
  installPrompt: () => Promise<void>;
  dismissUpdate: () => void;
  applyUpdate: () => void;
}

export function usePWA(): PWAState {
  const [isOnline, setIsOnline]           = useState(navigator.onLine);
  const [isInstalled, setIsInstalled]     = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistered, setSwRegistered]   = useState(false);

  const deferredPrompt = useRef<any>(null);
  const swReg          = useRef<ServiceWorkerRegistration | null>(null);

  // ── Online / offline ───────────────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Detect already installed (standalone mode) ─────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    setIsInstalled(mq.matches || (navigator as any).standalone === true);
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── beforeinstallprompt ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPrompt.current = null;
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Service Worker registration ────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        swReg.current = reg;
        setSwRegistered(true);
        console.log('[PWA] SW registered:', reg.scope);

        // Check for waiting update
        if (reg.waiting) setUpdateAvailable(true);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });

        // Listen for SYNC_QUEUE messages from SW
        navigator.serviceWorker.addEventListener('message', (e) => {
          if (e.data?.type === 'SYNC_QUEUE') {
            console.log('[PWA] SW signals offline queue sync');
            window.dispatchEvent(new CustomEvent('gem:sync-queue'));
          }
        });

      } catch (err) {
        console.warn('[PWA] SW registration failed:', err);
      }
    };

    register();
  }, []);

  // ── Install prompt ─────────────────────────────────────────────────────────
  const installPrompt = useCallback(async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    deferredPrompt.current = null;
    setIsInstallable(false);
  }, []);

  // ── Update controls ────────────────────────────────────────────────────────
  const dismissUpdate = useCallback(() => setUpdateAvailable(false), []);

  const applyUpdate = useCallback(() => {
    const reg = swReg.current;
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  }, []);

  return { isOnline, isInstalled, isInstallable, updateAvailable, swRegistered, installPrompt, dismissUpdate, applyUpdate };
}

// ─── Deep link parser — reads URL params set by manifest shortcuts ────────────
export function usePWADeepLink(onNavigate: (tab: string, sub?: string, extra?: Record<string, string>) => void) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab    = params.get('tab');
    const sub    = params.get('sub');
    const quick  = params.get('quick');
    const mTab   = params.get('mTab');

    if (tab) {
      const extra: Record<string, string> = {};
      if (quick) extra.quick = quick;
      if (mTab)  extra.mTab  = mTab;
      onNavigate(tab, sub ?? undefined, extra);
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
}
