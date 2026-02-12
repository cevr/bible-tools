/**
 * Background sync service — debounced push-only backup of state.db.
 *
 * After each write to state.db, resets a 30s debounce timer.
 * When the timer fires, exports the full state.db blob and POSTs it
 * to the server keyed by an anonymous device UUID.
 */
import type { DbClient } from '@/workers/db-client';

const SYNC_DEBOUNCE_MS = 30_000;

export interface SyncService {
  start(): void;
  stop(): void;
  syncNow(): Promise<void>;
}

export function createSyncService(client: DbClient): SyncService {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deviceId: string | null = null;
  let syncing = false;

  function resetTimer() {
    if (timer != null) clearTimeout(timer);
    timer = setTimeout(() => void doSync(), SYNC_DEBOUNCE_MS);
  }

  async function ensureDeviceId(): Promise<string> {
    if (deviceId) return deviceId;

    const rows = await client.query<{ device_id: string }>(
      'state',
      'SELECT device_id FROM sync_meta WHERE id = 1',
    );

    if (rows.length > 0) {
      deviceId = rows[0].device_id;
      return deviceId;
    }

    deviceId = crypto.randomUUID();
    await client.exec('INSERT INTO sync_meta (id, device_id) VALUES (1, ?)', [deviceId]);
    return deviceId;
  }

  async function doSync(): Promise<void> {
    if (syncing) return;
    syncing = true;
    try {
      const dirty = await client.isDirty();
      if (!dirty) return;

      const id = await ensureDeviceId();
      const blob = await client.exportState();

      const res = await fetch('/api/sync/state', {
        method: 'POST',
        headers: { 'X-Device-Id': id },
        body: blob,
      });

      if (!res.ok) {
        console.warn(`[sync] upload failed: ${res.status} ${res.statusText}`);
      } else {
        await client.exec('UPDATE sync_meta SET last_synced_at = ? WHERE id = 1', [Date.now()]);
      }
    } catch (err) {
      console.warn('[sync] error:', err);
    } finally {
      syncing = false;
    }
  }

  return {
    start() {
      client.onExec(resetTimer);
    },

    stop() {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    },

    syncNow() {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      return doSync();
    },
  };
}
