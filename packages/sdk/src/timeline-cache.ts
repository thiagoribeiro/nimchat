import type { RoomState } from "./store.ts";
import type { NimletEvent, RoomListEntry } from "./types.ts";

// What survives a restart: the /sync cursor plus a bounded slice of each room. Both travel in
// one snapshot, written together, so the cursor can never point past the events stored with
// it — a resumed /sync then only delivers what this snapshot hasn't seen.
export interface TimelineSnapshot {
  v: 1;
  cursor?: string;
  savedAt: number;
  events: NimletEvent[];
  // The last room list, so names and membership are there before GET /rooms answers
  // (or without network at all). Seeded with hydrateRooms(rooms, false).
  rooms?: RoomListEntry[];
}

// Pluggable like TokenStorage: IndexedDB on web, a file on mobile. Never an authority — a
// missing or unreadable snapshot just means a full /sync replay, as before.
export interface TimelineCacheStorage {
  load(): Promise<TimelineSnapshot | null>;
  save(snapshot: TimelineSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export function validSnapshot(data: unknown): data is TimelineSnapshot {
  const s = data as TimelineSnapshot | null;
  return (
    !!s &&
    s.v === 1 &&
    Array.isArray(s.events) &&
    (s.rooms === undefined || Array.isArray(s.rooms)) &&
    (s.cursor === undefined || typeof s.cursor === "string")
  );
}

export interface RetainOptions {
  // Newest events kept per room: enough to open a room with content and scroll a little.
  perRoom?: number;
  // Keys an event outside that window may be kept under. For each key, the first and the
  // last such event survive — e.g. a surface's first and latest state snapshot. The SDK
  // doesn't know what event types mean; callers (BRIAN) decide.
  pin?: (event: NimletEvent) => readonly string[];
}

export const RETAIN_PER_ROOM = 100;

export function retainTimeline(
  messagesByRoom: Record<string, readonly NimletEvent[]>,
  { perRoom = RETAIN_PER_ROOM, pin }: RetainOptions = {},
): NimletEvent[] {
  const kept: NimletEvent[] = [];
  for (const events of Object.values(messagesByRoom)) {
    const sorted = [...events].sort((a, b) => a.room_seq - b.room_seq);
    const cut = Math.max(0, sorted.length - perRoom);
    const older = new Set<NimletEvent>();
    if (pin) {
      const first = new Map<string, NimletEvent>();
      const last = new Map<string, NimletEvent>();
      for (const e of sorted.slice(0, cut))
        for (const key of pin(e)) {
          if (!first.has(key)) first.set(key, e);
          last.set(key, e);
        }
      for (const e of first.values()) older.add(e);
      for (const e of last.values()) older.add(e);
    }
    for (const e of sorted.slice(0, cut)) if (older.has(e)) kept.push(e);
    kept.push(...sorted.slice(cut));
  }
  return kept;
}

// Rooms as last listed by the server (entries created only from sync events have no state).
export function cachedRooms(rooms: Record<string, RoomState>): RoomListEntry[] {
  return Object.values(rooms).flatMap(({ room_id, name, join_rule, state, role }) =>
    state ? [{ room_id, name, join_rule: join_rule ?? "", state, role: role ?? "" }] : [],
  );
}

export interface TimelinePersisterOptions {
  storage: TimelineCacheStorage;
  read: () => Record<string, readonly NimletEvent[]>;
  rooms?: () => RoomListEntry[];
  retain?: RetainOptions;
  cursor?: string;
  debounceMs?: number;
  now?: () => number;
}

// Debounced writer. noteCursor() must be called right after the batch it came with was
// applied to the store (same tick), so every snapshot's cursor is covered by its events.
// Saves are serialized: a slow write never lands after a newer one.
export function createTimelinePersister({
  storage,
  read,
  retain,
  rooms,
  cursor,
  debounceMs = 500,
  now = Date.now,
}: TimelinePersisterOptions) {
  let current = cursor;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();
  let stopped = false;

  const write = () => {
    clearTimeout(timer);
    timer = undefined;
    if (stopped) return chain;
    const snapshot: TimelineSnapshot = {
      v: 1,
      cursor: current,
      savedAt: now(),
      events: retainTimeline(read(), retain),
      rooms: rooms?.(),
    };
    chain = chain.then(() => storage.save(snapshot)).catch(() => {});
    return chain;
  };

  return {
    noteCursor(next: string) {
      current = next;
      this.schedule();
    },
    schedule() {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(write, debounceMs);
    },
    flush(): Promise<void> {
      return timer ? write() : chain;
    },
    // Ends the session's writes; a pending debounce is written first.
    async stop(): Promise<void> {
      await this.flush();
      stopped = true;
    },
    // Ends the session dropping any pending write (logout), so storage.clear() can follow.
    discard(): Promise<void> {
      clearTimeout(timer);
      timer = undefined;
      stopped = true;
      return chain;
    },
    get cursor() {
      return current;
    },
  };
}
export type TimelinePersister = ReturnType<typeof createTimelinePersister>;
