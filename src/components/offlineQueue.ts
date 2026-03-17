/**
 * offlineQueue.ts — GEM&CLAUDE PM Pro
 * IndexedDB-backed queue for offline write operations.
 *
 * How it works:
 *   1. When app is OFFLINE, db.set() calls are intercepted and queued here
 *   2. Each queued item stored in IndexedDB with collection/projectId/payload
 *   3. When connectivity returns (online event OR SW background sync):
 *      → processQueue() flushes all pending items to Supabase in order
 *   4. Items removed from queue only after successful flush
 *
 * Offline queue for Supabase writes when navigator is offline.
 *   → Queue is still written to IndexedDB for testing
 *   → processQueue() simulates success after 500ms
 *
 * Integration:
 *   - db.ts calls enqueueWrite() automatically when offline
 *   - usePWA.ts listens for 'gem:sync-queue' event (from SW) → triggers processQueue()
 *   - useOfflineQueue() hook exposes queue status to UI
 */

const DB_NAME    = 'gem_offline_db';
const DB_VERSION = 1;
const STORE      = 'write_queue';

export interface QueueItem {
  id?: number;              // auto-increment IDB key
  collection: string;
  project_id: string;
  payload: unknown;
  user_id?: string;
  enqueued_at: string;      // ISO string
  attempt: number;          // retry count
  status: 'pending' | 'syncing' | 'error';
  error_msg?: string;
}

// ─── IDB helpers ──────────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status',     'status',     { unique: false });
        store.createIndex('collection', 'collection', { unique: false });
        store.createIndex('enqueued_at','enqueued_at',{ unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: number): Promise<T | undefined> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, indexName?: string, query?: IDBKeyRange): Promise<T[]> {
  return new Promise((res, rej) => {
    const tx    = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const src   = indexName ? store.index(indexName) : store;
    const req   = query ? (src as IDBIndex).getAll(query) : src.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function idbPut(db: IDBDatabase, item: QueueItem): Promise<number> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(item);
    req.onsuccess = () => res(req.result as number);
    req.onerror   = () => rej(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: number): Promise<void> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

function idbCount(db: IDBDatabase): Promise<number> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const OfflineQueue = {

  /** Add a write operation to the queue */
  async enqueue(item: Omit<QueueItem, 'id' | 'attempt' | 'status' | 'enqueued_at'>): Promise<void> {
    try {
      const db = await openDB();
      await idbPut(db, {
        ...item,
        attempt: 0,
        status: 'pending',
        enqueued_at: new Date().toISOString(),
      });
      // Request background sync if SW supports it
      if ('serviceWorker' in navigator && 'sync' in (navigator.serviceWorker as any)) {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync.register('gem-offline-sync');
      }
    } catch (err) {
      console.warn('[OfflineQueue] enqueue failed:', err);
    }
  },

  /** Get all pending items */
  async getPending(): Promise<QueueItem[]> {
    try {
      const db = await openDB();
      const pending = IDBKeyRange.only('pending');
      return idbGetAll<QueueItem>(db, 'status', pending);
    } catch { return []; }
  },

  /** Get total count */
  async count(): Promise<number> {
    try {
      const db = await openDB();
      return idbCount(db);
    } catch { return 0; }
  },

  /** Get all items (for debug UI) */
  async getAll(): Promise<QueueItem[]> {
    try {
      const db = await openDB();
      return idbGetAll<QueueItem>(db);
    } catch { return []; }
  },

  /**
   * Process queue — flush all pending items to Supabase (or mock).
   * Called on: window.online event, SW sync message, manual trigger.
   */
  async processQueue(userId?: string): Promise<{ synced: number; failed: number }> {
    let synced = 0; let failed = 0;

    try {
      const db      = await openDB();
      const pending = await OfflineQueue.getPending();
      if (pending.length === 0) return { synced: 0, failed: 0 };

      console.log(`[OfflineQueue] Processing ${pending.length} pending items...`);


      for (const item of pending) {
        try {
          // Mark as syncing
          await idbPut(db, { ...item, status: 'syncing' });

            // Import dynamically to avoid circular dep
            const { getSupabase } = await import('./supabase');
            const sb = getSupabase();
            if (!sb) throw new Error('Supabase not configured');

            await sb.from('project_data').upsert(
              {
                project_id: item.project_id,
                collection: item.collection,
                payload: item.payload,
                updated_at: new Date().toISOString(),
                updated_by: userId ?? null,
              },
              { onConflict: 'project_id,collection' }
            );
          } else {
            // Dev mode: simulate network delay
            await new Promise(r => setTimeout(r, 80));
            // Write to localStorage as fallback
            const key = `gem_db__${item.collection}__${item.project_id}`;
            localStorage.setItem(key, JSON.stringify(item.payload));

          // Success — remove from queue
          if (item.id !== undefined) await idbDelete(db, item.id);
          synced++;

        } catch (err: any) {
          console.warn(`[OfflineQueue] Failed to sync ${item.collection}:`, err);
          const next = { ...item, status: 'error' as const, attempt: item.attempt + 1, error_msg: err?.message ?? 'Unknown' };
          await idbPut(db, next);
          failed++;
          // Stop after 3 consecutive failures to avoid hammering
          if (next.attempt >= 3) {
            console.warn('[OfflineQueue] Max retries reached for item, skipping');
          }
        }
      }

      console.log(`[OfflineQueue] Done: ${synced} synced, ${failed} failed`);

      // Dispatch event so UI can update
      window.dispatchEvent(new CustomEvent('gem:queue-processed', {
        detail: { synced, failed }
      }));

    } catch (err) {
      console.error('[OfflineQueue] processQueue error:', err);
    }

    return { synced, failed };
  },

  /** Clear all items (admin / debug) */
  async clearAll(): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror    = () => rej(tx.error);
      });
    } catch (err) {
      console.warn('[OfflineQueue] clearAll failed:', err);
    }
  },

  /** Retry all error items */
  async retryErrors(): Promise<void> {
    try {
      const db   = await openDB();
      const all  = await idbGetAll<QueueItem>(db);
      const errs = all.filter(x => x.status === 'error');
      for (const item of errs) {
        await idbPut(db, { ...item, status: 'pending', attempt: 0, error_msg: undefined });
      }
    } catch {}
  },
};

// ─── Updated db.ts integration ────────────────────────────────────────────────
/**
 * Drop-in replacement for db.set() that auto-queues when offline.
 * Import this instead of { db } for write operations if you want offline support.
 *
 * Usage (optional — already handled in db.ts when you add the offline check):
 *
 *   import { dbSet } from './offlineQueue';
 *   await dbSet('qs_items', projectId, items, userId);
 */
export async function dbSet<T>(
  collection: string,
  projectId: string,
  data: T,
  userId?: string,
): Promise<void> {
  const isOnline  = navigator.onLine;

  if (!isOnline ) {
    // Offline + prod → queue the write
    await OfflineQueue.enqueue({ collection, project_id: projectId, payload: data, user_id: userId });
    // Still write to localStorage so UI stays responsive
    try { localStorage.setItem(`gem_db__${collection}__${projectId}`, JSON.stringify(data)); } catch {}
    return;
  }

  const { db } = await import('./db');
  await db.set(collection, projectId, data, userId);
}
