/**
 * useOfflineQueue.tsx — GEM&CLAUDE PM Pro
 * Hook + UI panel for offline queue monitoring.
 *
 * <OfflineQueuePanel /> — shows pending items, retry button, sync status.
 * Accessible from Taskbar or Settings.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { OfflineQueue, type QueueItem } from './offlineQueue';
import {
  CloudOff, RefreshCw, CheckCircle2, AlertTriangle,
  Loader2, Trash2, Wifi, X, Database, Clock,
  ChevronDown, ArrowUpCircle,
} from 'lucide-react';

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [lastSynced, setLastSynced]     = useState<Date | null>(null);
  const [lastResult, setLastResult]     = useState<{ synced: number; failed: number } | null>(null);

  const refresh = useCallback(async () => {
    const count = await OfflineQueue.count();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refresh();

    // Listen for sync events from SW and online event
    const onSync = () => {
      setIsSyncing(true);
      OfflineQueue.processQueue().then(result => {
        setLastResult(result);
        setLastSynced(new Date());
        setIsSyncing(false);
        refresh();
      });
    };

    const onQueueProcessed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setLastResult(detail);
      setLastSynced(new Date());
      refresh();
    };

    window.addEventListener('online', onSync);
    window.addEventListener('gem:sync-queue', onSync);
    window.addEventListener('gem:queue-processed', onQueueProcessed);

    // Poll pending count every 30s
    const interval = setInterval(refresh, 30_000);

    return () => {
      window.removeEventListener('online', onSync);
      window.removeEventListener('gem:sync-queue', onSync);
      window.removeEventListener('gem:queue-processed', onQueueProcessed);
      clearInterval(interval);
    };
  }, [refresh]);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const result = await OfflineQueue.processQueue();
    setLastResult(result);
    setLastSynced(new Date());
    setIsSyncing(false);
    refresh();
  }, [isSyncing, refresh]);

  const clearAll = useCallback(async () => {
    await OfflineQueue.clearAll();
    refresh();
  }, [refresh]);

  const retryErrors = useCallback(async () => {
    await OfflineQueue.retryErrors();
    refresh();
    syncNow();
  }, [refresh, syncNow]);

  return { pendingCount, isSyncing, lastSynced, lastResult, syncNow, clearAll, retryErrors, refresh };
}

// ─── Queue status badge (mini — for Taskbar) ──────────────────────────────────
export function QueueBadge({ count, isSyncing }: { count: number; isSyncing: boolean }) {
  if (count === 0 && !isSyncing) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
      ${isSyncing ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
      {isSyncing
        ? <><Loader2 size={9} className="animate-spin"/>Đang sync</>
        : <><CloudOff size={9}/>{count} chờ</>
      }
    </span>
  );
}

// ─── Full panel ───────────────────────────────────────────────────────────────
export function OfflineQueuePanel({ onClose }: { onClose: () => void }) {
  const { pendingCount, isSyncing, lastSynced, lastResult, syncNow, clearAll, retryErrors } = useOfflineQueue();
  const [items, setItems]       = useState<QueueItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isOnline]              = useState(navigator.onLine);

  useEffect(() => {
    OfflineQueue.getAll().then(setItems);
  }, [pendingCount, isSyncing]);

  const pending = items.filter(x => x.status === 'pending');
  const errors  = items.filter(x => x.status === 'error');
  const syncing = items.filter(x => x.status === 'syncing');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center
            ${pendingCount > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
            {pendingCount > 0
              ? <CloudOff size={16} className="text-amber-600"/>
              : <CheckCircle2 size={16} className="text-emerald-600"/>
            }
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Hàng đợi Offline</p>
            <p className="text-[10px] text-slate-400">
              {pendingCount === 0 ? 'Đã đồng bộ đầy đủ' : `${pendingCount} thao tác chờ đồng bộ`}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg">
          <X size={15}/>
        </button>
      </div>

      {/* Status strip */}
      <div className={`px-5 py-2.5 flex items-center gap-2 text-xs font-semibold
        ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
        {isOnline
          ? <><Wifi size={12}/> Đang kết nối — dữ liệu sẽ tự đồng bộ</>
          : <><CloudOff size={12}/> Offline — thao tác sẽ đồng bộ khi có mạng</>
        }
        {lastSynced && (
          <span className="ml-auto text-slate-400 font-normal">
            Lần cuối: {lastSynced.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })}
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-0 divide-x divide-slate-100 border-b border-slate-100">
        {[
          { label: 'Đang chờ',   val: pending.length,  cls: 'text-amber-600' },
          { label: 'Đang sync',  val: syncing.length,  cls: 'text-blue-600' },
          { label: 'Lỗi',        val: errors.length,   cls: 'text-rose-600' },
        ].map((k,i) => (
          <div key={i} className="flex flex-col items-center py-3">
            <span className={`text-xl font-black ${k.cls}`}>{k.val}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Last sync result */}
      {lastResult && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2
          ${lastResult.failed > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {lastResult.failed > 0
            ? <AlertTriangle size={12}/>
            : <CheckCircle2 size={12}/>
          }
          Đồng bộ: {lastResult.synced} thành công
          {lastResult.failed > 0 && `, ${lastResult.failed} thất bại`}
        </div>
      )}

      {/* Item list (collapsible) */}
      {items.length > 0 && (
        <div className="px-4 pt-3">
          <button onClick={() => setExpanded(p => !p)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-700 mb-2">
            <span className="flex items-center gap-1.5"><Database size={11}/>Chi tiết hàng đợi ({items.length})</span>
            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`}/>
          </button>
          {expanded && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pb-1">
              {items.map((item, i) => (
                <div key={item.id ?? i}
                  className={`flex items-center gap-2.5 p-2 rounded-xl text-xs border
                    ${item.status === 'pending' ? 'bg-amber-50 border-amber-100' :
                      item.status === 'error'   ? 'bg-rose-50 border-rose-100' :
                      'bg-blue-50 border-blue-100'}`}>
                  {item.status === 'pending' && <Clock size={11} className="text-amber-500 shrink-0"/>}
                  {item.status === 'syncing' && <Loader2 size={11} className="text-blue-500 animate-spin shrink-0"/>}
                  {item.status === 'error'   && <AlertTriangle size={11} className="text-rose-500 shrink-0"/>}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-700 truncate">{item.collection}</p>
                    <p className="text-slate-400 truncate">
                      project: {item.project_id} · {new Date(item.enqueued_at).toLocaleTimeString('vi-VN')}
                    </p>
                    {item.error_msg && <p className="text-rose-600 truncate">{item.error_msg}</p>}
                  </div>
                  <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full
                    ${item.status === 'pending' ? 'bg-amber-200 text-amber-800' :
                      item.status === 'error'   ? 'bg-rose-200 text-rose-800' :
                      'bg-blue-200 text-blue-800'}`}>
                    {item.status === 'pending' ? 'CHỜ' : item.status === 'error' ? 'LỖI' : 'SYNC'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-4 flex gap-2">
        <button onClick={syncNow} disabled={isSyncing || !isOnline}
          className="flex-1 flex items-center justify-center gap-2 py-2.5
            bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50
            text-white rounded-xl text-sm font-bold transition-colors">
          {isSyncing
            ? <><Loader2 size={14} className="animate-spin"/>Đang đồng bộ...</>
            : <><ArrowUpCircle size={14}/>Đồng bộ ngay</>
          }
        </button>
        {errors.length > 0 && (
          <button onClick={retryErrors}
            className="flex items-center gap-1.5 px-3 py-2.5
              bg-amber-100 hover:bg-amber-200 text-amber-800
              rounded-xl text-sm font-bold transition-colors">
            <RefreshCw size={13}/>Thử lại
          </button>
        )}
        {items.length > 0 && (
          <button onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-2.5
              bg-slate-100 hover:bg-rose-100 hover:text-rose-700
              text-slate-600 rounded-xl text-sm font-bold transition-colors">
            <Trash2 size={13}/>Xóa
          </button>
        )}
      </div>
    </div>
  );
}
