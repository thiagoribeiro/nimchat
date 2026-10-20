import { validSnapshot } from "@nimchat/sdk";
import type { TimelineCacheStorage, TimelineSnapshot } from "@nimchat/sdk";

import { NIMLET_URL } from "@/lib/nimlet";

const DB = "nimchat";
const STORE = "timeline";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

// One snapshot per server, namespace and user (same key shape as the mobile BRIAN cache).
// IndexedDB rather than localStorage: no ~5MB ceiling and no synchronous writes. Where it is
// unavailable (some private windows), every call fails quietly and sync replays in full.
export function timelineCache(userId: string): TimelineCacheStorage {
  const key = JSON.stringify([NIMLET_URL, process.env.NEXT_PUBLIC_NIMLET_NAMESPACE ?? "default", userId]);
  return {
    load: async () => {
      try {
        const data = await run("readonly", (s) => s.get(key));
        return validSnapshot(data) ? data : null;
      } catch {
        return null;
      }
    },
    save: async (snapshot: TimelineSnapshot) => {
      try {
        await run("readwrite", (s) => s.put(snapshot, key));
      } catch {}
    },
    clear: async () => {
      try {
        await run("readwrite", (s) => s.delete(key));
      } catch {}
    },
  };
}
