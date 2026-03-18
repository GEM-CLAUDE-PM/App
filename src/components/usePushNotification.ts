/**
 * usePushNotification.ts — GEM&CLAUDE PM Pro
 * S19 — Web Push (FCM via VAPID) subscription management
 *
 * Flow:
 *   1. User cho phép notification
 *   2. SW tạo PushSubscription với VAPID public key
 *   3. Token lưu vào Supabase table push_subscriptions
 *   4. Server (Edge Function) dùng token để push khi có sự kiện
 *      (approval cần duyệt, deadline, HSE alert)
 *
 * SETUP:
 *   1. Generate VAPID keys:
 *        npx web-push generate-vapid-keys
 *   2. Thêm vào .env:
 *        VITE_VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *        VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   ← server only
 *        VAPID_EMAIL=mailto:admin@gemclaudepm.com
 *   3. Chạy migration M-20 trong supabase_migration.sql
 *   4. Call usePushNotification() trong App.tsx sau khi user đăng nhập
 */

import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from './supabase';

const VAPID_PUBLIC_KEY = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY ?? '';

// Convert VAPID key từ base64 string → Uint8Array cho PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export interface PushState {
  permission:   NotificationPermission;   // 'default' | 'granted' | 'denied'
  subscribed:   boolean;
  requesting:   boolean;
  subscribe:    () => Promise<void>;
  unsubscribe:  () => Promise<void>;
}

export function usePushNotification(userId?: string): PushState {
  const [permission, setPermission]  = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [subscribed, setSubscribed]  = useState(false);
  const [requesting, setRequesting]  = useState(false);

  // Kiểm tra subscription hiện tại khi mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
    );
  }, []);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VITE_VAPID_PUBLIC_KEY chưa được cấu hình.');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Browser không hỗ trợ Push API.');
      return;
    }
    setRequesting(true);
    try {
      // 1. Xin quyền
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      // 2. Lấy SW registration
      const reg = await navigator.serviceWorker.ready;

      // 3. Subscribe với VAPID
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      setSubscribed(true);

      // 4. Lưu token vào Supabase
      if (userId) {
        const sb = getSupabase();
        if (sb) {
          await sb.from('push_subscriptions').upsert(
            {
              user_id:      userId,
              subscription: JSON.stringify(sub.toJSON()),
              user_agent:   navigator.userAgent.slice(0, 200),
              updated_at:   new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
        }
      }
    } catch (e) {
      console.warn('[Push] Subscribe failed:', e);
    } finally {
      setRequesting(false);
    }
  }, [userId]);

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setSubscribed(false);

      // Xóa token khỏi Supabase
      if (userId) {
        const sb = getSupabase();
        if (sb) await sb.from('push_subscriptions').delete().eq('user_id', userId);
      }
    } catch (e) {
      console.warn('[Push] Unsubscribe failed:', e);
    }
  }, [userId]);

  return { permission, subscribed, requesting, subscribe, unsubscribe };
}
